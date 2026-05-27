import {
  AMBIENCE_INTENSITY_GAIN,
  AMBIENCE_HARD_CEILING,
  AMBIENCE_SPACE_TRIM,
  AMBIENCE_POPULATION_TRIM,
  AMBIENCE_MOOD_SCALE,
  AMBIENCE_MOOD_MELODY_TEMPO,
  AMBIENCE_MOOD_PROGRESSION,
  AMBIENCE_MOOD_PULSE_BPM,
  AMBIENCE_MOOD_MUSIC_GAIN,
  AMBIENCE_SPACE_RECIPES,
  AMBIENCE_POPULATION_RECIPES,
  AMBIENCE_EVENT_RECIPES,
  sanitizeAmbience
} from "./tables.js";

export class AmbienceEngine {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio API unavailable");
    this.ctx = new AC();
    this.intensity = "off";
    this.muted = false;
    this.destroyed = false;
    this.startTime = this.ctx.currentTime;
    this.comfortGain = 1.0;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // Diegetic synth lanes — each holds a scene voice built from one of
    // the recipes in AMBIENCE_SPACE_RECIPES / AMBIENCE_POPULATION_RECIPES.
    this.scene = {
      space:      { gain: this._makeGain(0), voice: null, name: null, targetGain: 0 },
      population: { gain: this._makeGain(0), voice: null, name: null, targetGain: 0 }
    };

    // Music lanes (synth).
    this.chordPad = this._buildChordPad();
    this.melodyVoice = this._buildMelody();
    this.pulse = this._buildPulse();

    // Currently held GM input — fields stay until re-emitted.
    this.current = { space: null, population: null, mood: null };

    this.comfortInterval = setInterval(() => this._updateComfort(), 30000);
    this.melodyArmed = false;
    this.pulseArmed = false;
    this.chordArmed = false;
    // TTS coupling state
    this.speechGate = false;
    this.speechActive = false;
    this.boosted = false;
  }
  _makeGain(initial) {
    const g = this.ctx.createGain();
    g.gain.value = initial;
    g.connect(this.master);
    return g;
  }
  // ── Noise buffer helper (lifted from Hermes Agent Music, MIT) ─────
  _noiseBuffer(sec, type) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * sec));
    const b = ctx.createBuffer(1, len, rate);
    const d = b.getChannelData(0);
    if (type === "pink") {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < len; i++) {
        const w = Math.random()*2-1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
        b6 = w*0.115926;
      }
    } else if (type === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random()*2-1;
        last = (last + 0.02*w) / 1.02;
        d[i] = last * 3.5;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    }
    return b;
  }
  // ── Scene lanes (space, population) ───────────────────────────────
  _setSceneLane(lane, category, name, trimTable) {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const fadeTime = 2.5;
    const TC = fadeTime / 3;

    if (lane.voice) {
      const old = lane.voice;
      lane.gain.gain.cancelScheduledValues(ctx.currentTime);
      lane.gain.gain.setTargetAtTime(0, ctx.currentTime, TC);
      setTimeout(() => this._disposeSceneVoice(old), (fadeTime + 0.5) * 1000);
      lane.voice = null;
    }
    lane.name = name;
    if (!name) {
      lane.targetGain = 0;
      return;
    }
    const recipes = (category === "space") ? AMBIENCE_SPACE_RECIPES : AMBIENCE_POPULATION_RECIPES;
    const builder = recipes[name];
    if (!builder) { lane.targetGain = 0; return; }
    lane.voice = builder(this, lane.gain);
    lane.targetGain = (trimTable[name] != null) ? trimTable[name] : 0.5;
    lane.gain.gain.cancelScheduledValues(ctx.currentTime);
    lane.gain.gain.setValueAtTime(0, ctx.currentTime);
    lane.gain.gain.setTargetAtTime(lane.targetGain, ctx.currentTime, TC);
  }
  _disposeSceneVoice(voice) {
    if (!voice) return;
    if (voice.timers) voice.timers.forEach((t) => {
      try { clearTimeout(t); } catch (_) {}
      try { clearInterval(t); } catch (_) {}
    });
    if (voice.nodes) voice.nodes.forEach((n) => {
      try { if (typeof n.stop === "function") n.stop(); } catch (_) {}
      try { n.disconnect(); } catch (_) {}
    });
  }
  // ── Event one-shots (synthesised) ─────────────────────────────────
  _fireEvent(name) {
    if (this.destroyed) return;
    if (this.muted || this.intensity === "off") return;
    const recipe = AMBIENCE_EVENT_RECIPES[name];
    if (!recipe) return;
    const startAt = this.ctx.currentTime + 0.05 + Math.random() * 0.25;
    try { recipe(this, startAt); } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[ambience] event "${name}" failed:`, e);
      }
    }
  }
  // ── ChordPad ──────────────────────────────────────────────────────
  _buildChordPad() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 1200;
    lpf.Q.value = 0.5;
    lpf.connect(out);
    out.connect(this.master);
    // Three voice slots; each holds a {sine, tri, gain} group whose
    // frequency glides to the target chord tone on mood change.
    const baseHz = 110; // A2 — fixed root; pad lives near here.
    const voices = [];
    for (let i = 0; i < 3; i++) {
      const sine = ctx.createOscillator(); sine.type = "sine"; sine.frequency.value = baseHz;
      const tri  = ctx.createOscillator(); tri.type  = "triangle"; tri.frequency.value = baseHz;
      tri.detune.value = 4;
      const g = ctx.createGain(); g.gain.value = 0.16;
      sine.connect(g); tri.connect(g); g.connect(lpf);
      sine.start(); tri.start();
      voices.push({ sine, tri, gain: g });
    }
    return { out, lpf, voices, baseHz, progressionIdx: 0, scheduled: 0 };
  }
  _setChord(triadOffsets, glideSeconds) {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const TC = (glideSeconds || 4) / 3;
    triadOffsets.forEach((semitones, i) => {
      const voice = this.chordPad.voices[i];
      if (!voice) return;
      const freq = this.chordPad.baseHz * Math.pow(2, semitones / 12);
      voice.sine.frequency.setTargetAtTime(freq, t, TC);
      voice.tri.frequency.setTargetAtTime(freq, t, TC);
    });
  }
  _scheduleNextChord() {
    if (this.destroyed) return;
    const mood = this.current.mood;
    if (!mood || this.intensity === "off" || this.muted) {
      this.chordPad.scheduled = setTimeout(() => this._scheduleNextChord(), 5000);
      return;
    }
    const prog = AMBIENCE_MOOD_PROGRESSION[mood];
    if (!prog) {
      this.chordPad.scheduled = setTimeout(() => this._scheduleNextChord(), 5000);
      return;
    }
    const [root, quality] = prog[this.chordPad.progressionIdx % prog.length];
    const third = quality === "min" ? root + 3 : root + 4;
    this._setChord([root, third, root + 7], 4);
    this.chordPad.progressionIdx = (this.chordPad.progressionIdx + 1) % prog.length;
    const wait = 16000 + Math.random() * 8000;
    this.chordPad.scheduled = setTimeout(() => this._scheduleNextChord(), wait);
  }
  // ── MelodyVoice ───────────────────────────────────────────────────
  _buildMelody() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 1900;
    lpf.Q.value = 0.5;
    lpf.connect(out);
    out.connect(this.master);
    return { out, lpf, scaleDegree: 3, scheduled: 0 };
  }
  _melodyStep() {
    const r = Math.random();
    if (r < 0.10) return 0;
    if (r < 0.55) return Math.random() < 0.5 ? -1 : 1;
    if (r < 0.85) return Math.random() < 0.5 ? -2 : 2;
    return Math.random() < 0.5 ? -3 : 3;
  }
  _scheduleNextMelodyNote() {
    if (this.destroyed) return;
    const mood = this.current.mood;
    if (!mood || this.intensity === "off" || this.muted) {
      this.melodyVoice.scheduled = setTimeout(() => this._scheduleNextMelodyNote(), 4000);
      return;
    }
    const meanInterval = AMBIENCE_MOOD_MELODY_TEMPO[mood] || 5;
    const wait = -Math.log(1 - Math.random() * 0.99) * meanInterval;
    this.melodyVoice.scheduled = setTimeout(() => {
      this._fireMelodyNote();
      this._scheduleNextMelodyNote();
    }, Math.min(22000, wait * 1000));
  }
  _fireMelodyNote() {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const mood = this.current.mood;
    if (!mood) return;
    const scale = AMBIENCE_MOOD_SCALE[mood] || AMBIENCE_MOOD_SCALE.calm;
    const len = scale.length;
    let next = (this.melodyVoice.scaleDegree ?? 3) + this._melodyStep();
    if (next < 0) next = -next;
    if (next >= len) next = 2 * (len - 1) - next;
    next = Math.max(0, Math.min(len - 1, next));
    this.melodyVoice.scaleDegree = next;
    const root = 220; // A3 — melody sits an octave above the pad.
    const freq = root * Math.pow(2, scale[next] / 12);
    const release = 1.3 + Math.random() * 1.6;
    const peak = 0.08 + Math.random() * 0.03;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0005, now + release);
    osc.connect(g);
    g.connect(this.melodyVoice.lpf);
    osc.start(now);
    osc.stop(now + release + 0.1);
  }
  // ── Pulse ─────────────────────────────────────────────────────────
  _buildPulse() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    return { out, scheduled: 0 };
  }
  _schedulePulse() {
    if (this.destroyed) return;
    const mood = this.current.mood;
    const bpm = mood ? AMBIENCE_MOOD_PULSE_BPM[mood] : null;
    if (!bpm || this.intensity === "off" || this.muted) {
      this.pulse.scheduled = setTimeout(() => this._schedulePulse(), 4000);
      return;
    }
    this._firePulse();
    const interval = 60000 / bpm;
    this.pulse.scheduled = setTimeout(() => this._schedulePulse(), interval);
  }
  _firePulse() {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 55;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1.0, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.pulse.out);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  // ── Mood application ──────────────────────────────────────────────
  _applyMood(mood) {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const TC = 0.83;
    if (!mood) {
      this.chordPad.out.gain.setTargetAtTime(0, t, TC);
      this.melodyVoice.out.gain.setTargetAtTime(0, t, TC);
      this.pulse.out.gain.setTargetAtTime(0, t, TC);
      return;
    }
    const weights = AMBIENCE_MOOD_MUSIC_GAIN[mood] || AMBIENCE_MOOD_MUSIC_GAIN.calm;
    this.chordPad.out.gain.setTargetAtTime(weights.chord, t, TC);
    this.melodyVoice.out.gain.setTargetAtTime(weights.melody, t, TC);
    this.pulse.out.gain.setTargetAtTime(weights.pulse, t, TC);
    // Snap chord progression to a fresh starting voicing on mood change.
    this.chordPad.progressionIdx = 0;
    const prog = AMBIENCE_MOOD_PROGRESSION[mood];
    if (prog && prog[0]) {
      const [root, quality] = prog[0];
      const third = quality === "min" ? root + 3 : root + 4;
      this._setChord([root, third, root + 7], 2);
      this.chordPad.progressionIdx = 1;
    }
  }
  // ── Comfort / master gain ─────────────────────────────────────────
  _updateComfort() {
    if (this.destroyed || !this.ctx) return;
    const elapsed = this.ctx.currentTime - this.startTime;
    let target = 1.0;
    if (elapsed > 480) target = 0.85;
    if (elapsed > 1200) target = 0.75;
    if (Math.abs(target - this.comfortGain) > 0.001) {
      this.comfortGain = target;
      this._applyMaster();
    }
  }
  _applyMaster(fastCut) {
    if (this.destroyed || !this.ctx) return;
    const t = this.ctx.currentTime;
    const BOOST_MAP = { off: "off", subtle: "present", present: "present" };
    const effectiveIntensity = this.boosted ? BOOST_MAP[this.intensity] : this.intensity;
    const ceiling = AMBIENCE_INTENSITY_GAIN[effectiveIntensity] || 0;
    const raw = ceiling * this.comfortGain;
    let target = (this.muted || this.intensity === "off") ? 0 : Math.min(AMBIENCE_HARD_CEILING, raw);
    if (this.speechGate && !this.speechActive) target = 0;
    this.master.gain.setTargetAtTime(target, t, fastCut ? 0.04 : 0.5);
  }
  // ── Public API ────────────────────────────────────────────────────
  setIntensity(level) {
    if (this.destroyed) return;
    const prev = this.intensity;
    this.intensity = (level === "subtle" || level === "present") ? level : "off";
    if (this.intensity === "off") {
      this._applyMaster();
      setTimeout(() => {
        if (this.destroyed) return;
        if (this.intensity === "off" && this.ctx && this.ctx.state === "running") {
          this.ctx.suspend().catch(() => {});
        }
      }, 3200);
    } else {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      if (!this.melodyArmed) { this.melodyArmed = true; this._scheduleNextMelodyNote(); }
      if (!this.pulseArmed)  { this.pulseArmed  = true; this._schedulePulse(); }
      if (!this.chordArmed)  { this.chordArmed  = true; this._scheduleNextChord(); }
      if (prev === "off") this.startTime = this.ctx.currentTime;
      this._applyMaster();
    }
  }
  applyAmbience(input) {
    if (this.destroyed) return;
    if (input === undefined) return;
    if (input === null) {
      // Total silence: fade all lanes.
      this._setSceneLane(this.scene.space, "space", null, AMBIENCE_SPACE_TRIM);
      this._setSceneLane(this.scene.population, "population", null, AMBIENCE_POPULATION_TRIM);
      this.current.space = null;
      this.current.population = null;
      this.current.mood = null;
      this._applyMood(null);
      return;
    }
    if (typeof input !== "object") return;
    const sanitized = sanitizeAmbience(input);
    if (!sanitized) return;
    if ("space" in sanitized) {
      const next = sanitized.space; // string or null
      if (this.current.space !== next) {
        this.current.space = next;
        this._setSceneLane(this.scene.space, "space", next, AMBIENCE_SPACE_TRIM);
      }
    }
    if ("population" in sanitized) {
      const next = sanitized.population; // string or null
      if (this.current.population !== next) {
        this.current.population = next;
        this._setSceneLane(this.scene.population, "population", next, AMBIENCE_POPULATION_TRIM);
      }
    }
    if ("mood" in sanitized) {
      const next = sanitized.mood; // string or null
      if (this.current.mood !== next) {
        this.current.mood = next;
        this._applyMood(next);
      }
    }
    if (sanitized.events) {
      sanitized.events.forEach((name) => this._fireEvent(name));
    }
  }
  mute(bool) {
    if (this.destroyed) return;
    this.muted = !!bool;
    this._applyMaster(true);
  }
  setSpeechGate(on) {
    this.speechGate = !!on;
    if (!on) this.speechActive = false;
    this._applyMaster(false);
  }
  setBoost(on) {
    this.boosted = !!on;
    this._applyMaster(false);
  }
  notifySpeechStart() {
    if (!this.speechGate) return;
    this.speechActive = true;
    this._applyMaster(false);
  }
  notifySpeechEnd() {
    if (!this.speechGate) return;
    this.speechActive = false;
    this._applyMaster(false);
  }
  destroy() {
    this.destroyed = true;
    clearInterval(this.comfortInterval);
    if (this.melodyVoice && this.melodyVoice.scheduled) clearTimeout(this.melodyVoice.scheduled);
    if (this.pulse && this.pulse.scheduled) clearTimeout(this.pulse.scheduled);
    if (this.chordPad && this.chordPad.scheduled) clearTimeout(this.chordPad.scheduled);
    if (this.scene) {
      [this.scene.space, this.scene.population].forEach((lane) => {
        if (lane && lane.voice) this._disposeSceneVoice(lane.voice);
      });
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch (_) {}
    }
  }
}
