import type { AmbienceEvent, AmbienceInput, AmbienceMood, AmbiencePalette, AmbiencePopulation, AmbienceSpace } from "../types";
// ─────────────────────────────────────────────────────────────────────────
// Procedural synthesis recipes adapted from Hermes Agent Music (MIT)
//   https://github.com/jlaiii/hermes-agent-music
// Adapted pieces: noise-buffer generators, IR convolver reverb, piano-drift,
// kick/snare/hat voices, weather/nature beds (wind/ocean/thunder/birds/
// crickets/stream). Recomposed for The Borrowed Hour's mood/space/
// population taxonomy.
// ─────────────────────────────────────────────────────────────────────────

import {
  AMBIENCE_INTENSITY_GAIN,
  AMBIENCE_HARD_CEILING,
  AMBIENCE_SPACE_TRIM,
  AMBIENCE_POPULATION_TRIM,
  AMBIENCE_MOOD_SCALE,
  AMBIENCE_MOOD_MELODY_TEMPO,
  AMBIENCE_MOOD_PROGRESSION,
  AMBIENCE_MOOD_PROGRESSION_ALT,
  AMBIENCE_MOOD_PULSE_BPM,
  AMBIENCE_MOOD_MUSIC_GAIN,
  AMBIENCE_MOOD_INSTRUMENTATION,
  AMBIENCE_MOOD_DRUM_PATTERN,
  AMBIENCE_MOOD_DRUM_GAIN,
  AMBIENCE_MOOD_DRUM_BPM,
  AMBIENCE_SPACE_RECIPES,
  AMBIENCE_POPULATION_RECIPES,
  AMBIENCE_EVENT_RECIPES,
  AMBIENCE_PALETTE,
  AMBIENCE_PALETTE_DEFAULT,
  AMBIENCE_MASTER_LPF_DEFAULT,
  AMBIENCE_MASTER_LPF_CAP,
  AMBIENCE_ATTACK_FLOOR,
  AMBIENCE_LANE_GAIN_CEILING,
  AMBIENCE_MICRO_EVENTS,
  sanitizeAmbience
} from "./tables";

type PaletteConfig = {
  cutoff: number;
  melodyOsc: string;
  weights: { chord: number, melody: number, pulse: number, piano: number, pluck: number, strings: number, drums: number, celeste: number, choir_voice: number, marimba: number, glock: number };
  allow: { piano: boolean, pluck: boolean, pizz: boolean, bow: boolean, celeste: boolean, choir_voice: boolean, marimba: boolean, glock: boolean };
};

// Per-mood instrument peak-gain map (entries omit instruments that stay silent).
type MoodInstrumentation = { piano?: number; pluck?: number; pizz?: number; bow?: number; celeste?: number; choir_voice?: number; marimba?: number; glock?: number };
// One 16th-note drum slot; presence of a key triggers that voice.
type DrumSlot = { k?: number; s?: number; h?: number; t?: number; r?: number; sh?: number; br?: number };
// Per-mood drum-voice gain overrides.
type DrumGainOverride = { kick?: number; snare?: number; hat?: number; tom?: number; rim?: number; shaker?: number; brush?: number };
// Per-mood base music-lane gain weights.
type MoodMusicGain = { chord: number; melody: number; pulse: number };
// A single chord step: (root semitone offset, quality).
type ChordStep = [number, string];

// Typed views over the imported data tables. The tables are exported with
// narrow per-entry inferred types, so generic keyed access needs a wider
// structural view here. These are the same runtime objects (type-only casts).
const PALETTE_TABLE = AMBIENCE_PALETTE as Record<string, PaletteConfig>;
const PALETTE_DEFAULT_KEY = AMBIENCE_PALETTE_DEFAULT as AmbiencePalette;
const MOOD_INSTRUMENTATION = AMBIENCE_MOOD_INSTRUMENTATION as Record<string, MoodInstrumentation>;
const MOOD_DRUM_PATTERN = AMBIENCE_MOOD_DRUM_PATTERN as Record<string, DrumSlot[]>;
const MOOD_DRUM_GAIN = AMBIENCE_MOOD_DRUM_GAIN as Record<string, DrumGainOverride>;
const MOOD_DRUM_BPM = AMBIENCE_MOOD_DRUM_BPM as Record<string, number>;
const MOOD_MUSIC_GAIN = AMBIENCE_MOOD_MUSIC_GAIN as Record<string, MoodMusicGain>;
const MOOD_PROGRESSION = AMBIENCE_MOOD_PROGRESSION as unknown as Record<string, ChordStep[]>;
const MOOD_PROGRESSION_ALT = AMBIENCE_MOOD_PROGRESSION_ALT as unknown as Record<string, ChordStep[]>;
const MOOD_SCALE = AMBIENCE_MOOD_SCALE as Record<string, number[]>;
const INTENSITY_GAIN = AMBIENCE_INTENSITY_GAIN as Record<string, number>;

type SceneLane = {
  gain: GainNode;
  panner: StereoPannerNode;
  voice: { nodes?: AudioNode[], timers?: ReturnType<typeof setInterval>[] } | null;
  name: string | null;
  targetGain: number;
};

// Disposable voice returned by a scene recipe.
type SceneVoice = { nodes?: AudioNode[], timers?: ReturnType<typeof setInterval>[] } | null;

// Music-lane voice groups built by the _build* helpers.
type InstrumentLane = { out: GainNode; dry: GainNode; wet: GainNode; wetAmount: number; panner: StereoPannerNode };
type ChordPad = {
  out: GainNode;
  lpf: BiquadFilterNode;
  panner: StereoPannerNode;
  voices: { sine: OscillatorNode; tri: OscillatorNode; gain: GainNode }[];
  baseHz: number;
  progressionIdx: number;
  scheduled: ReturnType<typeof setTimeout> | 0;
};
type MelodyVoice = {
  out: GainNode;
  lpf: BiquadFilterNode;
  panner: StereoPannerNode;
  scaleDegree: number;
  scheduled: ReturnType<typeof setTimeout> | 0;
};
type PulseLane = { out: GainNode; panner: StereoPannerNode; scheduled: ReturnType<typeof setTimeout> | 0 };

export class AmbienceEngine {
  ctx: AudioContext;
  intensity: "off" | "subtle" | "present";
  muted: boolean;
  destroyed: boolean;
  _gen: number;
  suspendTimer: ReturnType<typeof setTimeout> | 0;
  startTime: number;
  comfortGain: number;
  master: GainNode;
  masterLPF: BiquadFilterNode;
  masterComp: DynamicsCompressorNode;
  reverbSend: GainNode;
  convolver: ConvolverNode;
  reverbReturn: GainNode;
  scene: { space: SceneLane, population: SceneLane };
  chordPad: ChordPad;
  melodyVoice: MelodyVoice;
  pulse: PulseLane;
  piano: InstrumentLane;
  pluck: InstrumentLane;
  strings: InstrumentLane;
  drums: InstrumentLane;
  celeste: InstrumentLane;
  choir: InstrumentLane;
  marimba: InstrumentLane;
  glockenspiel: InstrumentLane;
  softLimiter: DynamicsCompressorNode;
  highShelf: BiquadFilterNode;
  reverbPanner: StereoPannerNode;
  _reverbLfoTimer: ReturnType<typeof setTimeout> | 0;
  musicLevel: "off" | "sparse" | "full";
  current: { space: AmbienceSpace | null, population: AmbiencePopulation | null, mood: AmbienceMood | null, palette: AmbiencePalette | null };
  _paletteWeights: PaletteConfig;
  _activeProgression: Record<string, ChordStep[]>;
  comfortInterval: ReturnType<typeof setInterval>;
  _lastVisibleAt: number;
  _onVisibility: () => void;
  _onPageShow: (e: PageTransitionEvent) => void;
  _onBlur: () => void;
  _onFocus: () => void;
  melodyArmed: boolean;
  pulseArmed: boolean;
  chordArmed: boolean;
  drumsArmed: boolean;
  drumStep: number;
  drumScheduled: ReturnType<typeof setTimeout> | 0;
  speechGate: boolean;
  speechActive: boolean;
  boosted: boolean;
  _activeEvents: number;
  _melodyHistory: number[];
  _roomTone: { src: AudioBufferSourceNode; gain: GainNode } | null;
  _microTimer: ReturnType<typeof setTimeout> | 0;
  _sceneBreathTimers: ReturnType<typeof setTimeout>[];

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) throw new Error("Web Audio API unavailable");
    this.ctx = new AC();
    this.intensity = "off";
    this.muted = false;
    this.destroyed = false;
    // Generation counter incremented on every setIntensity transition.
    // Self-rescheduling timers (music lanes, suspend timer, _firePluck
    // cleanups) capture _gen in their closure and check it; mismatches
    // mean the closure was scheduled by a previous activation and must
    // not fire or reschedule. Guards against orphaned audio after rapid
    // off→on→off cycles.
    this._gen = 0;
    this.suspendTimer = 0;
    this.startTime = this.ctx.currentTime;
    this.comfortGain = 1.0;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;

    this.softLimiter = this.ctx.createDynamicsCompressor();
    this.softLimiter.threshold.value = -12;
    this.softLimiter.knee.value = 6;
    this.softLimiter.ratio.value = 2;
    this.softLimiter.attack.value = 0.003;
    this.softLimiter.release.value = 0.1;

    this.highShelf = this.ctx.createBiquadFilter();
    this.highShelf.type = "highshelf";
    this.highShelf.frequency.value = 6000;
    this.highShelf.gain.value = -3;

    this.masterLPF = this.ctx.createBiquadFilter();
    this.masterLPF.type = "lowpass";
    this.masterLPF.frequency.value = AMBIENCE_MASTER_LPF_DEFAULT;
    this.masterLPF.Q.value = 0.5;

    this.masterComp = this.ctx.createDynamicsCompressor();
    this.masterComp.threshold.value = -6;
    this.masterComp.knee.value = 6;
    this.masterComp.ratio.value = 3;
    this.masterComp.attack.value = 0.012;
    this.masterComp.release.value = 0.25;

    this.master.connect(this.softLimiter);
    this.softLimiter.connect(this.highShelf);
    this.highShelf.connect(this.masterLPF);
    this.masterLPF.connect(this.masterComp);
    this.masterComp.connect(this.ctx.destination);

    // Shared convolver reverb bus. Lanes that want wet tail connect to
    // reverbSend at a per-voice gain; reverbReturn lives under master.
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 1.0;
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this._impulseResponse(2.4, 2.0);
    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.55;
    this.reverbPanner = this.ctx.createStereoPanner();
    this.reverbPanner.pan.value = 0;
    this.reverbSend.connect(this.convolver);
    this.convolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.reverbPanner);
    this.reverbPanner.connect(this.master);
    this._reverbLfoTimer = 0;
    this._startReverbLfo();

    // Diegetic synth lanes — each holds a scene voice built from one of
    // the recipes in AMBIENCE_SPACE_RECIPES / AMBIENCE_POPULATION_RECIPES.
    /** @type {{ space: SceneLane, population: SceneLane }} */
    this.scene = {
      space:      { ...this._makePannedGain(0, -0.20), voice: null, name: null, targetGain: 0 },
      population: { ...this._makePannedGain(0, 0.20), voice: null, name: null, targetGain: 0 }
    };

    // Music lanes (synth).
    this.chordPad = this._buildChordPad();
    this.melodyVoice = this._buildMelody();
    this.pulse = this._buildPulse();
    // Instrument lanes — additive over chord/melody/pulse.
    this.piano       = this._buildInstrumentLane(0.45, -0.18);
    this.pluck       = this._buildInstrumentLane(0.30, 0.25);
    this.strings     = this._buildInstrumentLane(0.40, -0.12);
    this.drums       = this._buildInstrumentLane(0.12, 0.0);
    this.celeste     = this._buildInstrumentLane(0.50, 0.30);
    this.choir       = this._buildInstrumentLane(0.55, 0.0);
    this.marimba     = this._buildInstrumentLane(0.25, -0.25);
    this.glockenspiel = this._buildInstrumentLane(0.45, 0.20);
    this.musicLevel = "full"; // off | sparse | full

    // Currently held GM input — fields stay until re-emitted.
    /** @type {{ space: AmbienceSpace | null, population: AmbiencePopulation | null, mood: AmbienceMood | null, palette: AmbiencePalette | null }} */
    this.current = { space: null, population: null, mood: null, palette: null };
    this._paletteWeights = PALETTE_TABLE[PALETTE_DEFAULT_KEY];
    this._activeProgression = MOOD_PROGRESSION;
    this._activeEvents = 0;
    this._melodyHistory = [];
    this._roomTone = null;
    this._microTimer = 0;
    this._sceneBreathTimers = [];

    this.comfortInterval = setInterval(() => this._updateComfort(), 30000);
    // Page Visibility coupling. When the tab is hidden, browsers throttle JS
    // timers but the AudioContext clock keeps its own time. Without this, any
    // setInterval-driven scene layer (crickets, wind gusts, birds, thunder)
    // keeps spawning oscillators against a frozen currentTime; on resume the
    // queued bursts all play at the same instant — the "thundering herd"
    // screech. Suspending the context here freezes everything cleanly and the
    // spawn-callbacks in tables.js short-circuit on ctx.state !== "running".
    this._lastVisibleAt = Date.now();
    this._onVisibility = () => {
      if (this.destroyed || !this.ctx) return;
      if (document.hidden) {
        this._lastVisibleAt = Date.now();
        if (this.ctx.state === "running") this.ctx.suspend().catch(() => {});
      } else if (this.intensity !== "off" && this.ctx.state === "suspended") {
        this._resumeWithRamp();
      }
    };
    this._onPageShow = (e) => {
      if (this.destroyed || !this.ctx) return;
      if (e.persisted && this.intensity !== "off" && this.ctx.state === "suspended") {
        this._resumeWithRamp();
      }
    };
    this._onBlur = () => {
      if (this.destroyed || !this.ctx) return;
      if (this.ctx.state === "running") this.ctx.suspend().catch(() => {});
    };
    this._onFocus = () => {
      if (this.destroyed || !this.ctx) return;
      if (this.intensity !== "off" && this.ctx.state === "suspended") {
        this._resumeWithRamp();
      }
    };
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", this._onVisibility);
    }
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("pageshow", this._onPageShow);
      window.addEventListener("blur", this._onBlur);
      window.addEventListener("focus", this._onFocus);
    }
    this.melodyArmed = false;
    this.pulseArmed = false;
    this.chordArmed = false;
    this.drumsArmed = false;
    this.drumStep = 0;
    this.drumScheduled = 0;
    // TTS coupling state
    this.speechGate = false;
    this.speechActive = false;
    this.boosted = false;
  }
  _makeGain(initial: number) {
    const g = this.ctx.createGain();
    g.gain.value = initial;
    g.connect(this.master);
    return g;
  }
  _makePannedGain(initial: number, pan: number): { gain: GainNode; panner: StereoPannerNode } {
    const g = this.ctx.createGain();
    g.gain.value = initial;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(this.master);
    return { gain: g, panner: p };
  }
  _startReverbLfo() {
    const drift = () => {
      if (this.destroyed) return;
      const target = (Math.random() - 0.5) * 0.24;
      this.reverbPanner.pan.setTargetAtTime(target, this.ctx.currentTime, 5);
      this._reverbLfoTimer = setTimeout(drift, 15000);
    };
    drift();
  }
  _jitteredTimeout(callback: () => void, baseMs: number, jitter = 0.25): ReturnType<typeof setTimeout> {
    const actual = baseMs * (1 + (Math.random() * 2 - 1) * jitter);
    return setTimeout(callback, actual);
  }
  // ── Noise buffer helper (lifted from Hermes Agent Music, MIT) ─────
  _noiseBuffer(sec: number, type: "pink" | "brown" | "white") {
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
  // ── Impulse response (adapted from Hermes Agent Music, MIT) ───────
  _impulseResponse(seconds: number, decay: number) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }
  // ── Instrument lane scaffold ──────────────────────────────────────
  // Returns { out, dry, wet } where `out` is what notes connect to.
  // `out → dry → master` is the dry signal; `out → wet → reverbSend`
  // is the wet send at `wetAmount`. Both branches share the lane gain
  // (mood-controlled) so volume scales together.
  _buildInstrumentLane(wetAmount: number, pan = 0): InstrumentLane {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const dry = ctx.createGain(); dry.gain.value = 1.0;
    const wet = ctx.createGain(); wet.gain.value = wetAmount;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    out.connect(dry); dry.connect(panner); panner.connect(this.master);
    out.connect(wet); wet.connect(this.reverbSend);
    return { out, dry, wet, wetAmount, panner };
  }
  // ── Piano: detuned triangles, soft attack, long release ───────────
  _firePiano(freq: number, peak?: number, release?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 2500;
    lpf.Q.value = 0.5;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const rel = release || 2.5;
    const p = peak || 0.10;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.6);
    g.gain.linearRampToValueAtTime(p * 0.05, now + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0005, now + rel);
    lpf.connect(g); g.connect(this.piano.out);
    const detunes = [0, 0.5, -0.5];
    let ended = 0;
    detunes.forEach((d) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;
      o.detune.value = d;
      o.connect(lpf);
      o.onended = () => { if (++ended >= 3) { try { lpf.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} } };
      o.start(now);
      o.stop(now + rel + 0.1);
    });
  }
  // ── Pluck: Karplus-Strong (noise burst into feedback delay) ──────
  _firePluck(freq: number, peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const p = peak || 0.18;
    const delayTime = 1 / Math.max(40, freq);
    // Burst.
    const burst = ctx.createBufferSource();
    burst.buffer = this._noiseBuffer(0.02, "white");
    const burstGain = ctx.createGain();
    burstGain.gain.value = p;
    // Feedback loop.
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = delayTime;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.97;
    const fbLpf = ctx.createBiquadFilter();
    fbLpf.type = "lowpass";
    fbLpf.frequency.value = 2500;
    burst.connect(burstGain);
    burstGain.connect(delay);
    delay.connect(fbLpf);
    fbLpf.connect(fbGain);
    fbGain.connect(delay);
    // Output envelope to silence the ringing tail.
    const out = ctx.createGain();
    out.gain.setValueAtTime(1, now);
    out.gain.exponentialRampToValueAtTime(0.0005, now + 1.8);
    delay.connect(out);
    out.connect(this.pluck.out);
    burst.start(now);
    burst.stop(now + 0.05);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try { delay.disconnect(); } catch (_) {}
      try { fbLpf.disconnect(); } catch (_) {}
      try { fbGain.disconnect(); } catch (_) {}
      try { out.disconnect(); } catch (_) {}
    };
    burst.onended = cleanup;
    setTimeout(cleanup, 2200);
  }
  // ── Strings: saw+triangle stack through bandpass; bowed or pizz ──
  _fireStringNote(freq: number, mode: "bow" | "pizz", duration?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const isBow = mode === "bow";
    const dur = duration || (isBow ? 2.2 : 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.max(400, freq * 2);
    bp.Q.value = isBow ? 1.4 : 2.0;
    const env = ctx.createGain();
    if (isBow) {
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.18, now + 0.8);
      env.gain.setTargetAtTime(0.15, now + 0.9, 0.4);
      env.gain.setTargetAtTime(0.0005, now + dur - 0.3, 0.5);
    } else {
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.14, now + AMBIENCE_ATTACK_FLOOR);
      env.gain.exponentialRampToValueAtTime(0.0005, now + 0.35);
    }
    bp.connect(env); env.connect(this.strings.out);
    const saw = ctx.createOscillator(); saw.type = "sawtooth"; saw.frequency.value = freq;
    const tri = ctx.createOscillator(); tri.type = "triangle"; tri.frequency.value = freq;
    tri.detune.value = -7;
    saw.connect(bp); tri.connect(bp);
    let lfo, lfoGain;
    if (isBow) {
      lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 5.5;
      lfoGain = ctx.createGain(); lfoGain.gain.value = 6; // cents
      lfo.connect(lfoGain);
      lfoGain.connect(saw.detune);
      lfoGain.connect(tri.detune);
      lfo.start(now);
      lfo.stop(now + dur + 0.1);
    }
    saw.onended = () => { try { bp.disconnect(); } catch (_) {} try { env.disconnect(); } catch (_) {} };
    saw.start(now); saw.stop(now + dur + 0.1);
    tri.start(now); tri.stop(now + dur + 0.1);
  }
  _fireBow(freq: number, dur?: number) { this._fireStringNote(freq, "bow", dur); }
  _firePizz(freq: number)     { this._fireStringNote(freq, "pizz", 0.4); }
  // ── Drums: kick, snare, hat, tom, rim, shaker, brush ───────────
  _fireKick(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, now);
    o.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    const g = ctx.createGain();
    const p = peak || 0.9;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    o.connect(g); g.connect(this.drums.dry);
    o.onended = () => { try { g.disconnect(); } catch (_) {} };
    o.start(now); o.stop(now + 0.22);
  }
  _fireSnare(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.2, "white");
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 1.0;
    const g = ctx.createGain();
    const p = peak || 0.35;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + AMBIENCE_ATTACK_FLOOR);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(bp); bp.connect(g); g.connect(this.drums.out);
    src.onended = () => { try { bp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} };
    src.start(now); src.stop(now + 0.15);
  }
  _fireHat(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.08, "white");
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 7000;
    const g = ctx.createGain();
    const p = peak || 0.15;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src.connect(hp); hp.connect(g); g.connect(this.drums.out);
    src.onended = () => { try { hp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} };
    src.start(now); src.stop(now + 0.08);
  }
  _fireTom(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(90, now);
    o.frequency.exponentialRampToValueAtTime(50, now + 0.35);
    const g = ctx.createGain();
    const p = peak || 0.5;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
    o.connect(g); g.connect(this.drums.out);
    o.onended = () => { try { g.disconnect(); } catch (_) {} };
    o.start(now); o.stop(now + 0.42);
  }
  _fireRim(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.value = 800;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 3;
    const g = ctx.createGain();
    const p = peak || 0.3;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    o.connect(bp); bp.connect(g); g.connect(this.drums.out);
    o.onended = () => { try { bp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} };
    o.start(now); o.stop(now + 0.06);
  }
  _fireShaker(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.12, "pink");
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 3500; bp.Q.value = 1.5;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 3800;
    const g = ctx.createGain();
    const p = peak || 0.2;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.drums.out);
    src.onended = () => { try { bp.disconnect(); } catch (_) {} try { lp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} };
    src.start(now); src.stop(now + 0.12);
  }
  _fireBrush(peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.25, "brown");
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1800;
    const g = ctx.createGain();
    const p = peak || 0.18;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + AMBIENCE_ATTACK_FLOOR);
    g.gain.linearRampToValueAtTime(p * 0.3, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(lp); lp.connect(g); g.connect(this.drums.out);
    src.onended = () => { try { lp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} };
    src.start(now); src.stop(now + 0.25);
  }
  // ── Celeste: music-box / xylophone-like ────────────────────────────
  _fireCeleste(freq: number, peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const p = peak || 0.08;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq * 2; bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 1.2);
    o.connect(bp); bp.connect(g); g.connect(this.celeste.out);
    o.onended = () => { try { bp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} };
    o.start(now); o.stop(now + 1.3);
  }
  // ── Choir: breathy vocal pad ──────────────────────────────────────
  _fireChoir(freq: number, peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const p = peak || 0.06;
    const dur = 4.0;
    const bp1 = ctx.createBiquadFilter(); bp1.type = "bandpass"; bp1.frequency.value = 500; bp1.Q.value = 2;
    const bp2 = ctx.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.value = 1500; bp2.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 1.5);
    g.gain.setValueAtTime(p, now + dur - 1.5);
    g.gain.linearRampToValueAtTime(0.0005, now + dur);
    bp1.connect(bp2); bp2.connect(g); g.connect(this.choir.out);
    const detunes = [0, 3, -3];
    let ended = 0;
    detunes.forEach((d) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq; o.detune.value = d;
      o.connect(bp1);
      o.onended = () => { if (++ended >= 3) { try { bp1.disconnect(); } catch (_) {} try { bp2.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} } };
      o.start(now); o.stop(now + dur + 0.1);
    });
  }
  // ── Marimba: warm mallet percussion ───────────────────────────────
  _fireMarimba(freq: number, peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const p = peak || 0.10;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000; lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.8);
    lp.connect(g); g.connect(this.marimba.out);
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = freq * 4;
    const o2g = ctx.createGain(); o2g.gain.value = 0.3;
    o1.connect(lp); o2.connect(o2g); o2g.connect(lp);
    o1.onended = () => { try { lp.disconnect(); } catch (_) {} try { g.disconnect(); } catch (_) {} try { o2g.disconnect(); } catch (_) {} };
    o1.start(now); o1.stop(now + 0.9);
    o2.start(now); o2.stop(now + 0.9);
  }
  // ── Glockenspiel: metallic bell-like tones ────────────────────────
  _fireGlockenspiel(freq: number, peak?: number) {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const p = peak || 0.06;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 2.5);
    g.connect(this.glockenspiel.out);
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = freq * 2.76;
    const o2g = ctx.createGain(); o2g.gain.value = 0.25;
    o1.connect(g); o2.connect(o2g); o2g.connect(g);
    o1.onended = () => { try { g.disconnect(); } catch (_) {} try { o2g.disconnect(); } catch (_) {} };
    o1.start(now); o1.stop(now + 2.6);
    o2.start(now); o2.stop(now + 2.6);
  }
  _scheduleDrums(gen: number) {
    if (this.destroyed || gen !== this._gen) return;
    const mood = this.current.mood;
    const pattern = mood ? MOOD_DRUM_PATTERN[mood] : null;
    if (!mood || !pattern || this.intensity === "off" || this.muted || this.musicLevel !== "full") {
      this.drumStep = 0;
      this.drumScheduled = setTimeout(() => this._scheduleDrums(gen), 1500);
      return;
    }
    const bpm = AMBIENCE_MOOD_PULSE_BPM[mood] || MOOD_DRUM_BPM[mood] || 70;
    const sixteenthMs = (60000 / bpm) / 4;
    const slot: DrumSlot = pattern[this.drumStep % pattern.length] || {};
    const gainOv: DrumGainOverride = MOOD_DRUM_GAIN[mood] || {};
    if (slot.k)  this._fireKick(gainOv.kick != null ? gainOv.kick * 6 : 0.9);
    if (slot.s)  this._fireSnare(gainOv.snare != null ? gainOv.snare * 6 : 0.5);
    if (slot.h)  this._fireHat(gainOv.hat != null ? gainOv.hat * 6 : 0.35);
    if (slot.t)  this._fireTom(gainOv.tom != null ? gainOv.tom * 6 : 0.5);
    if (slot.r)  this._fireRim(gainOv.rim != null ? gainOv.rim * 6 : 0.3);
    if (slot.sh) this._fireShaker(gainOv.shaker != null ? gainOv.shaker * 6 : 0.2);
    if (slot.br) this._fireBrush(gainOv.brush != null ? gainOv.brush * 6 : 0.18);
    this.drumStep = (this.drumStep + 1) % pattern.length;
    const humanize = (Math.random() - 0.5) * 24;
    this.drumScheduled = setTimeout(() => this._scheduleDrums(gen), sixteenthMs + humanize);
  }
  // ── Scene lanes (space, population) ───────────────────────────────
  _setSceneLane(lane: SceneLane, category: "space" | "population", name: string | null, trimTable: Record<string, number>) {
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
  _disposeSceneVoice(voice: SceneVoice) {
    if (!voice) return;
    if (voice.timers) voice.timers.forEach((t) => {
      try { clearTimeout(t); } catch (_) {}
      try { clearInterval(t); } catch (_) {}
    });
    if (voice.nodes) voice.nodes.forEach((n: AudioNode) => {
      try { if (typeof (n as unknown as { stop?: () => void }).stop === "function") (n as unknown as { stop: () => void }).stop(); } catch (_) {}
      try { n.disconnect(); } catch (_) {}
    });
  }
  // ── Event one-shots (synthesised) ─────────────────────────────────
  _fireEvent(name: AmbienceEvent) {
    if (this.destroyed) return;
    if (this.muted || this.intensity === "off") return;
    if (this._activeEvents >= 4) return;
    const recipe = AMBIENCE_EVENT_RECIPES[name];
    if (!recipe) return;
    this._activeEvents++;
    const startAt = this.ctx.currentTime + 0.05 + Math.random() * 0.25;
    try { recipe(this, startAt); } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[ambience] event "${name}" failed:`, e);
      }
    }
    setTimeout(() => { this._activeEvents = Math.max(0, this._activeEvents - 1); }, 1500);
  }
  // ── ChordPad ──────────────────────────────────────────────────────
  _buildChordPad() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 1200;
    lpf.Q.value = 0.5;
    lpf.connect(out);
    out.connect(panner);
    panner.connect(this.master);
    // Four voice slots — 3 triad voices + 1 optional 9th.
    const baseHz = 110;
    const voices = [];
    for (let i = 0; i < 4; i++) {
      const sine = ctx.createOscillator(); sine.type = "sine"; sine.frequency.value = baseHz;
      const tri  = ctx.createOscillator(); tri.type  = "triangle"; tri.frequency.value = baseHz;
      tri.detune.value = 4;
      const g = ctx.createGain(); g.gain.value = i < 3 ? 0.16 : 0;
      sine.connect(g); tri.connect(g); g.connect(lpf);
      sine.start(); tri.start();
      voices.push({ sine, tri, gain: g });
    }
    return { out, lpf, panner, voices, baseHz, progressionIdx: 0, scheduled: 0 };
  }
  _setChord(triadOffsets: number[], glideSeconds?: number) {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const TC = (glideSeconds || 4) / 3;
    triadOffsets.forEach((semitones: number, i: number) => {
      const voice = this.chordPad.voices[i];
      if (!voice) return;
      const freq = this.chordPad.baseHz * Math.pow(2, semitones / 12);
      voice.sine.frequency.setTargetAtTime(freq, t, TC);
      voice.tri.frequency.setTargetAtTime(freq, t, TC);
    });
    const v4 = this.chordPad.voices[3];
    if (v4) {
      if (Math.random() < 0.20) {
        const ninthSemitones = triadOffsets[0] + 14;
        const freq9 = this.chordPad.baseHz * Math.pow(2, ninthSemitones / 12);
        v4.sine.frequency.setTargetAtTime(freq9, t, TC);
        v4.tri.frequency.setTargetAtTime(freq9, t, TC);
        v4.gain.gain.setTargetAtTime(0.10, t, TC);
      } else {
        v4.gain.gain.setTargetAtTime(0, t, TC);
      }
    }
  }
  _scheduleNextChord(gen: number) {
    if (this.destroyed || gen !== this._gen) return;
    const mood = this.current.mood;
    if (!mood || this.intensity === "off" || this.muted) {
      this.chordPad.scheduled = setTimeout(() => this._scheduleNextChord(gen), 5000);
      return;
    }
    const prog = (this._activeProgression[mood]) || MOOD_PROGRESSION[mood];
    if (!prog) {
      this.chordPad.scheduled = setTimeout(() => this._scheduleNextChord(gen), 5000);
      return;
    }
    const [root, quality] = prog[this.chordPad.progressionIdx % prog.length];
    const third = quality === "min" ? root + 3 : root + 4;
    this._setChord([root, third, root + 7], 4);
    this.chordPad.progressionIdx = (this.chordPad.progressionIdx + 1) % prog.length;
    this.chordPad.scheduled = this._jitteredTimeout(() => this._scheduleNextChord(gen), 20000);
  }
  // ── MelodyVoice ───────────────────────────────────────────────────
  _buildMelody() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0.12;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 1900;
    lpf.Q.value = 0.5;
    lpf.connect(out);
    out.connect(panner);
    panner.connect(this.master);
    return { out, lpf, panner, scaleDegree: 3, scheduled: 0 };
  }
  _melodyStep() {
    let step: number;
    const r = Math.random();
    if (r < 0.10) step = 0;
    else if (r < 0.55) step = Math.random() < 0.5 ? -1 : 1;
    else if (r < 0.85) step = Math.random() < 0.5 ? -2 : 2;
    else step = Math.random() < 0.5 ? -3 : 3;
    if (this._melodyHistory.length >= 3) {
      const allAsc = this._melodyHistory.every(s => s > 0);
      const allDesc = this._melodyHistory.every(s => s < 0);
      if (allAsc && step > 0) step = -step;
      else if (allDesc && step < 0) step = -step;
    }
    this._melodyHistory.push(step);
    if (this._melodyHistory.length > 3) this._melodyHistory.shift();
    return step;
  }
  _scheduleNextMelodyNote(gen: number) {
    if (this.destroyed || gen !== this._gen) return;
    const mood = this.current.mood;
    if (!mood || this.intensity === "off" || this.muted) {
      this.melodyVoice.scheduled = setTimeout(() => this._scheduleNextMelodyNote(gen), 4000);
      return;
    }
    const meanInterval = AMBIENCE_MOOD_MELODY_TEMPO[mood] || 5;
    const wait = -Math.log(1 - Math.random() * 0.99) * meanInterval;
    this.melodyVoice.scheduled = setTimeout(() => {
      if (this.destroyed || gen !== this._gen) return;
      this._fireMelodyNote();
      this._fireInstrumentNote();
      this._scheduleNextMelodyNote(gen);
    }, Math.min(22000, wait * 1000));
  }
  // Fire piano/pluck/pizz on the same scale-degree the melody just used,
  // weighted by mood instrumentation. Bowed strings are timing-different
  // (long sustains) — handled by a separate slower scheduler below.
  _fireInstrumentNote() {
    if (this.destroyed) return;
    const mood = this.current.mood;
    if (!mood) return;
    const instr = MOOD_INSTRUMENTATION[mood];
    if (!instr) return;
    const scale = MOOD_SCALE[mood] || MOOD_SCALE.calm;
    const degree = this.melodyVoice.scaleDegree ?? 3;
    const root = 220; // A3
    const freq = root * Math.pow(2, scale[degree] / 12);
    // Each instrument fires with a per-mood probability so they don't all
    // play every melody beat — sparseness sells the minimalist feel.
    // Palette allow gating suppresses instrument types outside this palette's
    // character; palette can suppress but never invent lanes the mood didn't ask for.
    const allow = this._paletteWeights?.allow || { piano: true, pluck: true, pizz: true, bow: true, celeste: false, choir_voice: false, marimba: false, glock: false };
    const prog = this._activeProgression[mood] || MOOD_PROGRESSION[mood];
    const prevIdx = (this.chordPad.progressionIdx + prog.length - 1) % prog.length;
    const [chordRoot] = prog[prevIdx];
    if (instr.piano && allow.piano && Math.random() < 0.45) {
      this._firePiano(freq * 0.5, 0.10, 2.5 + Math.random() * 1.2);
    }
    if (instr.pluck && allow.pluck && Math.random() < 0.55) {
      this._firePluck(freq, 0.18);
    }
    if (instr.pizz && allow.pizz && Math.random() < 0.50) {
      this._firePizz(freq);
    }
    if (instr.bow && allow.bow && Math.random() < 0.25) {
      this._fireBow(110 * Math.pow(2, chordRoot / 12) * 2, 3.5 + Math.random() * 2);
    }
    if (instr.celeste && allow.celeste && Math.random() < 0.35) {
      this._fireCeleste(freq * 2, 0.08);
    }
    if (instr.choir_voice && allow.choir_voice && Math.random() < 0.20) {
      this._fireChoir(110 * Math.pow(2, chordRoot / 12), 0.06);
    }
    if (instr.marimba && allow.marimba && Math.random() < 0.40) {
      this._fireMarimba(freq, 0.10);
    }
    if (instr.glock && allow.glock && Math.random() < 0.25) {
      this._fireGlockenspiel(freq * 2, 0.06);
    }
  }
  _fireMelodyNote() {
    if (this.destroyed || !this.ctx || this.ctx.state !== "running") return;
    const mood = this.current.mood;
    if (!mood) return;
    const scale = MOOD_SCALE[mood] || MOOD_SCALE.calm;
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
    osc.type = (this._paletteWeights?.melodyOsc || "triangle") as OscillatorType;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0005, now + release);
    osc.connect(g);
    g.connect(this.melodyVoice.lpf);
    osc.onended = () => { try { g.disconnect(); } catch (_) {} };
    osc.start(now);
    osc.stop(now + release + 0.1);
  }
  // ── Pulse ─────────────────────────────────────────────────────────
  _buildPulse() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = -0.08;
    out.connect(panner);
    panner.connect(this.master);
    return { out, panner, scheduled: 0 };
  }
  _schedulePulse(gen: number) {
    if (this.destroyed || gen !== this._gen) return;
    const mood = this.current.mood;
    const bpm = mood ? AMBIENCE_MOOD_PULSE_BPM[mood] : null;
    if (!bpm || this.intensity === "off" || this.muted) {
      this.pulse.scheduled = setTimeout(() => this._schedulePulse(gen), 4000);
      return;
    }
    this._firePulse();
    const interval = 60000 / bpm;
    this.pulse.scheduled = setTimeout(() => this._schedulePulse(gen), interval);
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
    osc.onended = () => { try { g.disconnect(); } catch (_) {} };
    osc.start(now);
    osc.stop(now + 0.25);
  }
  // ── Voicing / mood application ────────────────────────────────────
  // _applyVoicing writes all music lane gains; called by both _applyMood
  // and _applyPalette so the two never fight over the same gain nodes.
  _applyVoicing() {
    if (this.destroyed) return;
    const mood = this.current.mood;
    if (!mood) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const TC = 0.83;
    const clamp = (v: number) => Math.min(AMBIENCE_LANE_GAIN_CEILING, Math.max(0, v));
    const pw = this._paletteWeights || PALETTE_TABLE[PALETTE_DEFAULT_KEY];
    const weights = MOOD_MUSIC_GAIN[mood] || MOOD_MUSIC_GAIN.calm;
    const instr: MoodInstrumentation = MOOD_INSTRUMENTATION[mood] || {};
    // Shadow the melody oscillator when piano takes the foreground.
    const melodyScale = instr.piano ? 0.35 : 1.0;
    const melodicScale = this.musicLevel === "off" ? 0
      : this.musicLevel === "sparse" ? 0.6
      : 1.0;
    const drumScale = this.musicLevel === "full" ? 1.0 : 0;
    this.chordPad.out.gain.setTargetAtTime(clamp(weights.chord * (pw.weights.chord ?? 1)), t, TC);
    this.melodyVoice.out.gain.setTargetAtTime(clamp(weights.melody * melodyScale * (pw.weights.melody ?? 1)), t, TC);
    this.pulse.out.gain.setTargetAtTime(clamp(weights.pulse * (pw.weights.pulse ?? 1)), t, TC);
    this.piano.out.gain.setTargetAtTime(clamp((instr.piano || 0) * melodicScale * (pw.weights.piano ?? 1)), t, TC);
    this.pluck.out.gain.setTargetAtTime(clamp((instr.pluck || 0) * melodicScale * (pw.weights.pluck ?? 1)), t, TC);
    const stringPeak = Math.max(instr.pizz || 0, instr.bow || 0);
    this.strings.out.gain.setTargetAtTime(clamp(stringPeak * melodicScale * (pw.weights.strings ?? 1)), t, TC);
    this.drums.out.gain.setTargetAtTime(clamp((MOOD_DRUM_PATTERN[mood] ? 1.0 : 0) * drumScale * (pw.weights.drums ?? 1)), t, TC);
    this.celeste.out.gain.setTargetAtTime(clamp((instr.celeste || 0) * melodicScale * pw.weights.celeste), t, TC);
    this.choir.out.gain.setTargetAtTime(clamp((instr.choir_voice || 0) * melodicScale * pw.weights.choir_voice), t, TC);
    this.marimba.out.gain.setTargetAtTime(clamp((instr.marimba || 0) * melodicScale * pw.weights.marimba), t, TC);
    this.glockenspiel.out.gain.setTargetAtTime(clamp((instr.glock || 0) * melodicScale * pw.weights.glock), t, TC);
  }
  _applyMood(mood: AmbienceMood | null) {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const TC = 0.83;
    if (!mood) {
      this.chordPad.out.gain.setTargetAtTime(0, t, TC);
      this.melodyVoice.out.gain.setTargetAtTime(0, t, TC);
      this.pulse.out.gain.setTargetAtTime(0, t, TC);
      this.piano.out.gain.setTargetAtTime(0, t, TC);
      this.pluck.out.gain.setTargetAtTime(0, t, TC);
      this.strings.out.gain.setTargetAtTime(0, t, TC);
      this.drums.out.gain.setTargetAtTime(0, t, TC);
      this.celeste.out.gain.setTargetAtTime(0, t, TC);
      this.choir.out.gain.setTargetAtTime(0, t, TC);
      this.marimba.out.gain.setTargetAtTime(0, t, TC);
      this.glockenspiel.out.gain.setTargetAtTime(0, t, TC);
      return;
    }
    // Randomly select primary or alt chord progression on mood change.
    this._activeProgression = Math.random() < 0.5 ? MOOD_PROGRESSION : MOOD_PROGRESSION_ALT;
    // Snap chord progression to a fresh starting voicing.
    this.chordPad.progressionIdx = 0;
    const prog = this._activeProgression[mood] || MOOD_PROGRESSION[mood];
    if (prog && prog[0]) {
      const [root, quality] = prog[0];
      const third = quality === "min" ? root + 3 : root + 4;
      this._setChord([root, third, root + 7], 2);
      this.chordPad.progressionIdx = 1;
    }
    this._applyVoicing();
  }
  // Apply a palette by name (null → default). Glides the master LPF cutoff
  // and rewrites lane gains without bumping _gen or rescheduling lanes.
  _applyPalette(name: AmbiencePalette | null | undefined) {
    if (this.destroyed) return;
    const cfg = (name !== null && name !== undefined && PALETTE_TABLE[name])
      ? PALETTE_TABLE[name]
      : PALETTE_TABLE[PALETTE_DEFAULT_KEY];
    this._paletteWeights = cfg;
    const cutoff = Math.min(AMBIENCE_MASTER_LPF_CAP, cfg.cutoff);
    this.masterLPF.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 1.5);
    this._applyVoicing();
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
  _applyMaster(fastCut?: boolean) {
    if (this.destroyed || !this.ctx) return;
    const t = this.ctx.currentTime;
    const BOOST_MAP: Record<string, string> = { off: "off", subtle: "present", present: "present" };
    const effectiveIntensity = this.boosted ? BOOST_MAP[this.intensity] : this.intensity;
    const ceiling = INTENSITY_GAIN[effectiveIntensity] || 0;
    const raw = ceiling * this.comfortGain;
    let target = (this.muted || this.intensity === "off") ? 0 : Math.min(AMBIENCE_HARD_CEILING, raw);
    if (this.speechGate && !this.speechActive) target = 0;
    this.master.gain.setTargetAtTime(target, t, fastCut ? 0.04 : 0.5);
  }
  setIntensity(level: "off" | "subtle" | "present") {
    if (this.destroyed) return;
    const prev = this.intensity;
    this.intensity = (level === "subtle" || level === "present") ? level : "off";
    // Bump generation so any in-flight self-rescheduling closures from the
    // previous activation stop perpetuating themselves. Music lane re-arm
    // below installs fresh closures with the new generation.
    this._gen += 1;
    const gen = this._gen;
    // Cancel a pending suspend if we're flipping back on inside the 3.2s
    // grace, or replacing an older suspend timer with a new one.
    if (this.suspendTimer) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = 0;
    }
    // Re-arming is gated by the *Armed flags so the schedulers don't get
    // double-installed; clear those flags so the new generation re-arms.
    this.melodyArmed = false;
    this.pulseArmed = false;
    this.chordArmed = false;
    this.drumsArmed = false;
    if (this.intensity === "off") {
      this._applyMaster();
      this._stopRoomTone();
      if (this._microTimer) { clearTimeout(this._microTimer); this._microTimer = 0; }
      this._stopSceneBreathing();
      this.suspendTimer = setTimeout(() => {
        this.suspendTimer = 0;
        if (this.destroyed || gen !== this._gen) return;
        if (this.intensity === "off" && this.ctx && this.ctx.state === "running") {
          this.ctx.suspend().catch(() => {});
        }
      }, 3200);
    } else {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.melodyArmed = true; this._scheduleNextMelodyNote(gen);
      this.pulseArmed  = true; this._schedulePulse(gen);
      this.chordArmed  = true; this._scheduleNextChord(gen);
      this.drumsArmed  = true; this._scheduleDrums(gen);
      this._startRoomTone();
      this._startMicroEvents(gen);
      this._startSceneBreathing(gen);
      if (prev === "off") this.startTime = this.ctx.currentTime;
      this._applyMaster();
    }
  }
  applyAmbience(input: AmbienceInput | null | undefined) {
    if (this.destroyed) return;
    if (input === undefined) return;
    if (input === null) {
      // Total silence: fade all lanes.
      this._setSceneLane(this.scene.space, "space", null, AMBIENCE_SPACE_TRIM);
      this._setSceneLane(this.scene.population, "population", null, AMBIENCE_POPULATION_TRIM);
      this.current.space = null;
      this.current.population = null;
      this.current.mood = null;
      this.current.palette = null;
      this._paletteWeights = PALETTE_TABLE[PALETTE_DEFAULT_KEY];
      this._applyMood(null);
      return;
    }
    if (typeof input !== "object") return;
    const sanitized = sanitizeAmbience(input);
    if (!sanitized) return;
    if ("space" in sanitized) {
      const next = sanitized.space as AmbienceSpace | null; // string or null
      if (this.current.space !== next) {
        this.current.space = next;
        this._setSceneLane(this.scene.space, "space", next, AMBIENCE_SPACE_TRIM);
      }
    }
    if ("population" in sanitized) {
      const next = sanitized.population as AmbiencePopulation | null; // string or null
      if (this.current.population !== next) {
        this.current.population = next;
        this._setSceneLane(this.scene.population, "population", next, AMBIENCE_POPULATION_TRIM);
      }
    }
    if ("palette" in sanitized) {
      const next = sanitized.palette as AmbiencePalette | null; // string or null
      if (this.current.palette !== next) {
        this.current.palette = next;
        this._applyPalette(next);
      }
    }
    if ("mood" in sanitized) {
      const next = sanitized.mood as AmbienceMood | null; // string or null
      if (this.current.mood !== next) {
        this.current.mood = next;
        this._applyMood(next);
      }
    }
    if (sanitized.events) {
      sanitized.events.forEach((name: AmbienceEvent) => this._fireEvent(name));
    }
  }
  mute(bool: boolean) {
    if (this.destroyed) return;
    this.muted = !!bool;
    this._applyMaster(true);
  }
  setMusicLevel(level: "off" | "sparse" | "full") {
    if (this.destroyed) return;
    const next = (level === "off" || level === "sparse" || level === "full") ? level : "full";
    if (this.musicLevel === next) return;
    this.musicLevel = next;
    if (this.current.mood) this._applyVoicing();
  }
  _resumeWithRamp() {
    if (this.destroyed || !this.ctx || this.ctx.state !== "suspended") return;
    const away = Date.now() - (this._lastVisibleAt || Date.now());
    this.ctx.resume().then(() => {
      if (this.destroyed || !this.master) return;
      if (away > 2000) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setValueAtTime(0, this.ctx.currentTime);
        this._applyMaster(false);
      }
    }).catch(() => {});
  }
  resume() {
    if (this.destroyed) return;
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }
  setSpeechGate(on: boolean) {
    this.speechGate = !!on;
    if (!on) this.speechActive = false;
    this._applyMaster(false);
  }
  setBoost(on: boolean) {
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
  // ── Ambient micro-layers ───────────────────────────────────────────
  _startRoomTone() {
    if (this.destroyed || this._roomTone) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3, "brown");
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    src.connect(g);
    g.connect(this.master);
    src.start();
    this._roomTone = { src, gain: g };
  }
  _stopRoomTone() {
    if (!this._roomTone) return;
    try { this._roomTone.src.stop(); } catch (_) {}
    try { this._roomTone.src.disconnect(); } catch (_) {}
    try { this._roomTone.gain.disconnect(); } catch (_) {}
    this._roomTone = null;
  }
  _startMicroEvents(gen: number) {
    if (this.destroyed || gen !== this._gen) return;
    const fire = () => {
      if (this.destroyed || gen !== this._gen) return;
      if (this.intensity !== "off" && !this.muted) {
        const mood = this.current.mood || "calm";
        const pool = AMBIENCE_MICRO_EVENTS[mood] || AMBIENCE_MICRO_EVENTS.calm;
        if (pool && pool.length) {
          const name = pool[Math.floor(Math.random() * pool.length)];
          const recipe = AMBIENCE_EVENT_RECIPES[name];
          if (recipe) {
            const ctx = this.ctx;
            const startAt = ctx.currentTime + 0.05;
            const g = ctx.createGain();
            g.gain.value = 0.05;
            g.connect(this.master);
            try { recipe({ ctx, master: g, _noiseBuffer: this._noiseBuffer.bind(this) }, startAt); } catch (_) {}
            setTimeout(() => { try { g.disconnect(); } catch (_) {} }, 3000);
          }
        }
      }
      const baseMs = 20000 + Math.random() * 25000;
      this._microTimer = this._jitteredTimeout(fire, baseMs);
    };
    this._microTimer = this._jitteredTimeout(fire, 20000 + Math.random() * 25000);
  }
  _startSceneBreathing(gen: number) {
    if (this.destroyed || gen !== this._gen) return;
    this._stopSceneBreathing();
    const breathe = (lane: SceneLane) => {
      const tick = () => {
        if (this.destroyed || gen !== this._gen) return;
        if (lane.targetGain <= 0) {
          const timer = this._jitteredTimeout(tick, 30000);
          this._sceneBreathTimers.push(timer);
          return;
        }
        const depth = 0.04;
        const offset = (Math.random() - 0.5) * 2 * depth;
        const target = Math.max(0, lane.targetGain + offset);
        lane.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 8);
        const timer = this._jitteredTimeout(tick, 20000 + Math.random() * 20000);
        this._sceneBreathTimers.push(timer);
      };
      const timer = this._jitteredTimeout(tick, 20000 + Math.random() * 20000);
      this._sceneBreathTimers.push(timer);
    };
    breathe(this.scene.space);
    breathe(this.scene.population);
  }
  _stopSceneBreathing() {
    this._sceneBreathTimers.forEach(t => clearTimeout(t));
    this._sceneBreathTimers = [];
  }
  destroy() {
    this.destroyed = true;
    clearInterval(this.comfortInterval);
    if (this._onVisibility && typeof document !== "undefined" && document.removeEventListener) {
      document.removeEventListener("visibilitychange", this._onVisibility);
    }
    if (typeof window !== "undefined" && window.removeEventListener) {
      if (this._onPageShow) window.removeEventListener("pageshow", this._onPageShow);
      if (this._onBlur) window.removeEventListener("blur", this._onBlur);
      if (this._onFocus) window.removeEventListener("focus", this._onFocus);
    }
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    if (this.melodyVoice && this.melodyVoice.scheduled) clearTimeout(this.melodyVoice.scheduled);
    if (this.pulse && this.pulse.scheduled) clearTimeout(this.pulse.scheduled);
    if (this.chordPad && this.chordPad.scheduled) clearTimeout(this.chordPad.scheduled);
    if (this.drumScheduled) clearTimeout(this.drumScheduled);
    if (this._reverbLfoTimer) clearTimeout(this._reverbLfoTimer);
    if (this._microTimer) clearTimeout(this._microTimer);
    this._stopSceneBreathing();
    this._stopRoomTone();
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
