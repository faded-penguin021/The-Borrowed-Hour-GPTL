import type { AmbienceInput, AmbienceSpace, AmbiencePopulation, AmbienceMood, AmbiencePalette, AmbienceEvent } from "../types";
// ─────────────────────────────────────────────────────────────────────────
// Procedural synthesis recipes adapted from Hermes Agent Music (MIT)
//   https://github.com/jlaiii/hermes-agent-music
// Adapted pieces: noise-buffer generators, IR convolver reverb, piano-drift,
// kick/snare/hat voices, weather/nature beds (wind/ocean/thunder/birds/
// crickets/stream). Recomposed for The Borrowed Hour's mood/space/
// population taxonomy.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Minimal shape of the ambience engine passed to recipe/event factories.
 */
type AmbienceEngine = {
  ctx: AudioContext;
  master: AudioNode;
  _noiseBuffer: (seconds: number, color: "pink" | "brown" | "white") => AudioBuffer;
};

/**
 * Disposable set of audio nodes and timers returned by a scene layer.
 */
type LayerResult = {
  nodes: AudioNode[];
  timers: ReturnType<typeof setInterval>[];
};

export const AMBIENCE_INTENSITY_GAIN = { off: 0, subtle: 0.10, present: 0.22 };
export const AMBIENCE_HARD_CEILING = 0.30;

import {
  AMBIENCE_SPACE_VALUES,
  AMBIENCE_POPULATION_VALUES,
  AMBIENCE_MOOD_VALUES,
  AMBIENCE_PALETTE_VALUES,
  AMBIENCE_EVENT_VALUES
} from "./enums";

export const AMBIENCE_SPACES = new Set(AMBIENCE_SPACE_VALUES);
export const AMBIENCE_POPULATIONS = new Set(AMBIENCE_POPULATION_VALUES);
export const AMBIENCE_MOODS = new Set(AMBIENCE_MOOD_VALUES);
export const AMBIENCE_PALETTES = new Set(AMBIENCE_PALETTE_VALUES);
export const AMBIENCE_EVENTS = new Set(AMBIENCE_EVENT_VALUES);

// Master safety-bus and voice guardrail constants.
export const AMBIENCE_MASTER_LPF_DEFAULT = 3200;
export const AMBIENCE_MASTER_LPF_CAP     = 4000;
export const AMBIENCE_ATTACK_FLOOR       = 0.02;
export const AMBIENCE_RELEASE_FLOOR      = 0.12;
export const AMBIENCE_LANE_GAIN_CEILING  = 0.45;
export const AMBIENCE_PALETTE_DEFAULT    = "piano";
// A2. Every pitched lane transposes from here by the story's tonal center.
export const AMBIENCE_TONIC_BASE_HZ      = 110;

// Palette config — TIMBRE only, never adds lanes the mood didn't ask for.
// cutoff ≤ CAP; melodyOsc for the melody voice oscillator type;
// weights are multipliers (≤1) against the mood base for each lane;
// allow gates which instrument types may actually fire this turn.
export const AMBIENCE_PALETTE = {
  piano:   { cutoff: 3200, melodyOsc: "triangle",  weights: { chord: 1.0, melody: 1.0, pulse: 1.0, piano: 1.0, pluck: 0.6, strings: 0.7, drums: 0.8, celeste: 0.8, choir_voice: 0.0, marimba: 0.7, glock: 0.0 }, allow: { piano: true,  pluck: true,  pizz: true,  bow: true,  celeste: true,  choir_voice: false, marimba: true,  glock: false } },
  synth:   { cutoff: 3600, melodyOsc: "sawtooth",  weights: { chord: 0.9, melody: 1.0, pulse: 1.0, piano: 0.3, pluck: 0.4, strings: 0.5, drums: 1.0, celeste: 0.7, choir_voice: 0.0, marimba: 0.8, glock: 0.6 }, allow: { piano: false, pluck: true,  pizz: true,  bow: false, celeste: true,  choir_voice: false, marimba: true,  glock: true  } },
  glass:   { cutoff: 3800, melodyOsc: "triangle",  weights: { chord: 0.8, melody: 1.0, pulse: 0.5, piano: 0.5, pluck: 1.0, strings: 0.4, drums: 0.3, celeste: 1.0, choir_voice: 0.0, marimba: 0.0, glock: 0.9 }, allow: { piano: true,  pluck: true,  pizz: false, bow: false, celeste: true,  choir_voice: false, marimba: false, glock: true  } },
  choir:   { cutoff: 2800, melodyOsc: "sine",      weights: { chord: 1.0, melody: 0.7, pulse: 0.6, piano: 0.4, pluck: 0.3, strings: 0.8, drums: 0.4, celeste: 0.0, choir_voice: 1.0, marimba: 0.0, glock: 0.0 }, allow: { piano: false, pluck: false, pizz: false, bow: true,  celeste: false, choir_voice: true,  marimba: false, glock: false } },
  strings: { cutoff: 3000, melodyOsc: "triangle",  weights: { chord: 0.9, melody: 0.9, pulse: 0.8, piano: 0.5, pluck: 0.7, strings: 1.0, drums: 0.6, celeste: 0.6, choir_voice: 0.7, marimba: 0.0, glock: 0.0 }, allow: { piano: true,  pluck: true,  pizz: true,  bow: true,  celeste: true,  choir_voice: true,  marimba: false, glock: false } },
  reed:    { cutoff: 2400, melodyOsc: "sine",      weights: { chord: 0.8, melody: 0.8, pulse: 0.7, piano: 0.4, pluck: 1.0, strings: 0.6, drums: 0.5, celeste: 0.0, choir_voice: 0.0, marimba: 0.7, glock: 0.0 }, allow: { piano: false, pluck: true,  pizz: true,  bow: false, celeste: false, choir_voice: false, marimba: true,  glock: false } },
  brass:   { cutoff: 2200, melodyOsc: "sine",      weights: { chord: 0.7, melody: 0.6, pulse: 0.5, piano: 0.3, pluck: 0.2, strings: 0.5, drums: 0.0, celeste: 0.0, choir_voice: 0.6, marimba: 0.0, glock: 0.0 }, allow: { piano: false, pluck: false, pizz: false, bow: false, celeste: false, choir_voice: true,  marimba: false, glock: false } },
  guitar:  { cutoff: 3200, melodyOsc: "triangle",  weights: { chord: 0.9, melody: 1.0, pulse: 0.8, piano: 0.6, pluck: 1.0, strings: 0.7, drums: 0.7, celeste: 0.0, choir_voice: 0.0, marimba: 0.7, glock: 0.0 }, allow: { piano: true,  pluck: true,  pizz: true,  bow: false, celeste: false, choir_voice: false, marimba: true,  glock: false } }
};

// Per-scene loudness trims — relative voice gains feeding the master.
// Tuned by ear; samples are no longer involved.
export const AMBIENCE_SPACE_TRIM = {
  intimate: 0.45, chamber: 0.50, hall: 0.55, cavern: 0.65,
  street:   0.60, field:   0.55, forest:   0.55,
  vehicle:  0.65, void:    0.55,
  underwater: 0.60, tavern: 0.55
};
export const AMBIENCE_POPULATION_TRIM = {
  solitary: 0.30, sparse_voices: 0.40, crowd:    0.50, machinery: 0.55,
  nature:   0.45, ceremony:      0.45, creature: 0.50, wild:      0.60,
  spirits: 0.45, rain: 0.50
};

// Per-space acoustics for the shared reverb bus. ret = wet-return gain,
// damp = lowpass cutoff (Hz) on the return, so the same music reads dry in
// a vehicle and cathedral-wet in a cavern. Param glides only — the engine
// never swaps the convolver IR, which would click mid-scene.
export const AMBIENCE_REVERB_DEFAULT = { ret: 0.55, damp: 3200 };
export const AMBIENCE_SPACE_REVERB = {
  intimate:   { ret: 0.30, damp: 1800 },
  chamber:    { ret: 0.45, damp: 2600 },
  hall:       { ret: 0.75, damp: 3200 },
  cavern:     { ret: 0.90, damp: 2400 },
  street:     { ret: 0.40, damp: 2800 },
  field:      { ret: 0.28, damp: 3000 },
  forest:     { ret: 0.35, damp: 2600 },
  vehicle:    { ret: 0.25, damp: 1600 },
  void:       { ret: 0.85, damp: 2200 },
  underwater: { ret: 0.80, damp: 1200 },
  tavern:     { ret: 0.50, damp: 2400 }
};

// Mood → musical voicing tables.
// Scales: degrees in semitones over two octaves; melody walks them.
export const AMBIENCE_MOOD_SCALE = {
  calm:        [0,2,4,7,9,12,14,16,19,21],   // pentatonic major
  tender:      [0,2,4,7,9,12,14,16,19,21],   // pentatonic major
  joyous:      [0,2,4,5,7,9,11,12,14,16],    // ionian (major)
  melancholy:  [0,3,5,7,10,12,15,17,19,22],  // pentatonic minor
  ominous:     [0,3,5,7,10,12,15,17,19,22],  // pentatonic minor
  tense:       [0,1,3,5,7,8,10,12,13,15],    // phrygian
  urgent:      [0,1,3,5,7,8,10,12,13,15],    // phrygian
  mysterious:  [0,2,3,5,7,9,10,12,14,15]     // dorian
};
// Mean inter-note interval in seconds.
export const AMBIENCE_MOOD_MELODY_TEMPO = {
  calm: 6.0, tender: 5.0, melancholy: 7.0, joyous: 3.0,
  tense: 2.0, urgent: 1.2, ominous: 8.0, mysterious: 9.0
};
// Triads as (root_semitone_offset, quality). Each mood has 4 chords cycled.
// "maj" = [r, r+4, r+7]; "min" = [r, r+3, r+7].
export const AMBIENCE_MOOD_PROGRESSION = {
  calm:       [[0,"maj"],[9,"min"],[5,"maj"],[7,"maj"]],
  tender:     [[0,"maj"],[5,"maj"],[2,"min"],[7,"maj"]],
  joyous:     [[0,"maj"],[7,"maj"],[5,"maj"],[4,"min"]],
  melancholy: [[0,"min"],[8,"maj"],[3,"maj"],[10,"maj"]],
  ominous:    [[0,"min"],[8,"maj"],[1,"maj"],[3,"maj"]],
  tense:      [[0,"min"],[1,"maj"],[7,"maj"],[0,"min"]],
  urgent:     [[0,"min"],[5,"min"],[7,"min"],[0,"min"]],
  mysterious: [[0,"min"],[2,"min"],[10,"maj"],[5,"min"]]
};
// Pulse tempo (BPM). null disables pulse for the mood.
export const AMBIENCE_MOOD_PULSE_BPM: Record<string, number | null> = {
  calm: 40, tender: null, melancholy: 48, joyous: 62,
  tense: 70, urgent: 90, ominous: 50, mysterious: null
};
// Per-voice gain weights at peak; multiplied by master.
export const AMBIENCE_MOOD_MUSIC_GAIN = {
  calm:       { chord: 0.18, melody: 0.30, pulse: 0.04 },
  tender:     { chord: 0.22, melody: 0.32, pulse: 0.00 },
  joyous:     { chord: 0.18, melody: 0.35, pulse: 0.04 },
  melancholy: { chord: 0.25, melody: 0.30, pulse: 0.03 },
  ominous:    { chord: 0.30, melody: 0.25, pulse: 0.04 },
  tense:      { chord: 0.20, melody: 0.28, pulse: 0.05 },
  urgent:     { chord: 0.18, melody: 0.30, pulse: 0.05 },
  mysterious: { chord: 0.28, melody: 0.32, pulse: 0.00 }
};

// Mood → instrument peak gains. Each instrument is summed with the existing
// chord/melody/pulse weights into the same master ceiling — values are
// intentionally modest so the music ceiling holds with TTS narration.
// Entries omitted (or 0) mean that instrument is silent for that mood.
export const AMBIENCE_MOOD_INSTRUMENTATION = {
  calm:       { piano: 0.22, celeste: 0.14 },
  tender:     { piano: 0.20, pluck: 0.12, choir_voice: 0.16, celeste: 0.10 },
  melancholy: { piano: 0.24, pizz:  0.14, choir_voice: 0.18 },
  ominous:    { piano: 0.18, bow:   0.22, choir_voice: 0.22 },
  joyous:     { piano: 0.16, pluck: 0.18, celeste: 0.16, marimba: 0.14, glock: 0.10 },
  tense:      { pizz:  0.16, bow:   0.14, marimba: 0.12 },
  urgent:     { pizz:  0.18, marimba: 0.16 },
  mysterious: { piano: 0.20, pluck: 0.14, celeste: 0.12, glock: 0.08, choir_voice: 0.14 }
};

// 16th-note drum patterns; 16 slots per bar at AMBIENCE_MOOD_PULSE_BPM[mood].
// Slot keys: k=kick, s=snare, h=hat, t=tom, r=rim, sh=shaker, br=brush.
// Sparse moods leave most slots empty so drums breathe with the narration.
// Moods with null BPM use 40 BPM fallback for their patterns.
export const AMBIENCE_MOOD_DRUM_PATTERN = {
  calm: [
    { br:1 }, { }, { }, { },
    { },     { }, { }, { },
    { },     { }, { }, { sh:1 },
    { },     { }, { }, { }
  ],
  melancholy: [
    { k:1 },  { }, { }, { },
    { },      { }, { }, { br:1 },
    { },      { }, { }, { },
    { },      { }, { br:1 }, { }
  ],
  ominous: [
    { k:1 },  { }, { }, { },
    { },      { }, { t:1 }, { },
    { k:1 },  { }, { }, { },
    { },      { }, { }, { t:1 }
  ],
  tense: [
    { k:1 },  { },     { r:1 }, { },
    { },      { sh:1 }, { h:1 }, { },
    { k:1 },  { },     { },    { r:1 },
    { t:1 },  { sh:1 }, { h:1 }, { }
  ],
  urgent: [
    { k:1 },  { h:1 },  { r:1 },  { h:1 },
    { s:1 },  { h:1 },  { sh:1 }, { h:1 },
    { k:1 },  { h:1 },  { k:1 },  { h:1 },
    { s:1 },  { h:1 },  { t:1 },  { h:1 }
  ],
  joyous: [
    { sh:1 }, { },     { sh:1 }, { },
    { r:1 },  { sh:1 }, { },     { sh:1 },
    { },      { },     { sh:1 }, { },
    { r:1 },  { sh:1 }, { },     { sh:1 }
  ],
  mysterious: [
    { },      { }, { }, { },
    { sh:1 }, { }, { }, { },
    { },      { }, { }, { },
    { },      { }, { sh:1 }, { }
  ],
  tender: [
    { br:1 }, { }, { }, { },
    { },      { }, { }, { },
    { },      { }, { }, { },
    { },      { }, { }, { br:1 }
  ]
};

// Drum-specific BPM for moods whose pulse BPM is null. The drum scheduler
// falls back to this before its hardcoded 70 BPM default.
export const AMBIENCE_MOOD_DRUM_BPM = {
  tender: 32,
  mysterious: 36
};

// Per-mood drum-voice peak gains (overrides drumBus default).
export const AMBIENCE_MOOD_DRUM_GAIN = {
  calm:       { brush: 0.04, shaker: 0.03 },
  tender:     { brush: 0.03 },
  melancholy: { kick: 0.06, brush: 0.04 },
  ominous:    { kick: 0.08, tom: 0.06 },
  tense:      { kick: 0.10, hat: 0.06, rim: 0.05, shaker: 0.04, tom: 0.07 },
  urgent:     { kick: 0.14, snare: 0.08, hat: 0.10, rim: 0.06, shaker: 0.05, tom: 0.08 },
  joyous:     { shaker: 0.06, rim: 0.05 },
  mysterious: { shaker: 0.03 }
};

// Alternate 4-chord progressions per mood — selected 50/50 on mood change.
export const AMBIENCE_MOOD_PROGRESSION_ALT = {
  calm:       [[0,"maj"],[4,"min"],[7,"maj"],[2,"min"]],
  tender:     [[0,"maj"],[9,"min"],[5,"maj"],[0,"maj"]],
  joyous:     [[0,"maj"],[5,"maj"],[9,"min"],[7,"maj"]],
  melancholy: [[0,"min"],[5,"min"],[8,"maj"],[3,"maj"]],
  ominous:    [[0,"min"],[3,"min"],[8,"maj"],[5,"maj"]],
  tense:      [[0,"min"],[5,"min"],[1,"maj"],[7,"min"]],
  urgent:     [[0,"min"],[7,"min"],[5,"min"],[3,"min"]],
  mysterious: [[0,"min"],[5,"min"],[2,"min"],[7,"maj"]]
};

// Micro-event categories per mood group — used by the ambient micro-layer.
export const AMBIENCE_MICRO_EVENTS: Record<string, string[]> = {
  calm:       ["breath_held", "paper_rustle", "water_drip"],
  tender:     ["breath_held", "paper_rustle", "water_drip"],
  melancholy: ["sigh_close", "bell_distant", "water_drip"],
  tense:      ["metal_clang", "footsteps_recede", "lock_click"],
  urgent:     ["metal_clang", "footsteps_recede", "lock_click"],
  ominous:    ["whisper_close", "door_creak", "owl_hoot"],
  mysterious: ["whisper_close", "door_creak", "owl_hoot"],
  joyous:     ["glass_set_down", "coin_drop", "keys_jingle"]
};

// Realm-derived opening ambience. Used to guarantee the world has sound from
// the very first turn (before the GM has emitted its own ambience). All four
// fields — space, mood, palette, population — are live and applied by the
// engine; palette sets the master LPF cutoff and lane weights for each realm's
// distinct opening timbre.
export const AMBIENCE_REALM_DEFAULTS: Record<string, AmbienceInput> = {
  neon:  { space: "street",  mood: "mysterious", palette: "synth",   population: "machinery" },
  dream: { space: "void",    mood: "mysterious", palette: "glass",   population: "solitary"  },
  echo:  { space: "hall",    mood: "melancholy", palette: "piano",   population: "solitary"  },
  omen:  { space: "cavern",  mood: "ominous",    palette: "choir",   population: "solitary"  },
  wild:  { space: "forest",  mood: "calm",       palette: "strings", population: "nature"    }
};
export const AMBIENCE_REALM_FALLBACK: AmbienceInput = { space: "intimate", mood: "calm", palette: "piano", population: "solitary" };
export const defaultAmbienceForRealm = (realm: string): AmbienceInput =>
  AMBIENCE_REALM_DEFAULTS[realm] || AMBIENCE_REALM_FALLBACK;

// Ordered keyword classifier for Wild (custom) realm turn-1 beds.
// Specific keywords come before generic ones so "starship" beats "vehicle".
// Returns a fresh object every call.
export const deriveAmbienceFromSeed = (seed: string): AmbienceInput => {
  const s = (seed || "").toLowerCase();
  const rules: [string[], AmbienceInput][] = [
    [["submarine", "underwater"],                            { space: "vehicle",  population: "machinery",     mood: "ominous",    palette: "synth"   }],
    [["starship", "orbital", "space-station", "space station"], { space: "void", population: "machinery",     mood: "mysterious", palette: "synth"   }],
    [["cyberpunk", "neon", "chrome", "arcology", "alley"],   { space: "street",   population: "machinery",     mood: "tense",      palette: "synth"   }],
    [["desert", "dune", "frontier"],                         { space: "field",    population: "wild",          mood: "calm",       palette: "guitar"  }],
    [["forest", "woods", "jungle"],                          { space: "forest",   population: "nature",        mood: "calm",       palette: "strings" }],
    [["temple", "cathedral", "sacred"],                      { space: "hall",     population: "ceremony",      mood: "ominous",    palette: "choir"   }],
    [["manor", "gothic", "castle"],                          { space: "chamber",  population: "solitary",      mood: "ominous",    palette: "strings" }],
    [["train", "carriage", "vehicle"],                       { space: "vehicle",  population: "sparse_voices", mood: "calm",       palette: "piano"   }],
    [["city", "market", "tavern"],                           { space: "street",   population: "crowd",         mood: "joyous",     palette: "strings" }],
  ];
  for (const [keywords, config] of rules) {
    if (keywords.some((k) => s.includes(k))) return { ...config };
  }
  return { space: "intimate", population: "solitary", mood: "calm", palette: "piano" };
};

// Story-level tonal center, in semitones around A (range −5..+6, E..D♯).
// Fixed realms get curated keys; Wild seeds hash (FNV-1a) to one, so the
// same premise always returns in the same key. Deliberately not a GM-schema
// field: the key is part of the story's identity, not the per-turn mood, and
// keeping it out of the tool schema means the model can't thrash it.
export const AMBIENCE_REALM_TONAL_CENTER: Record<string, number> = {
  neon: -2, dream: 3, echo: -4, omen: 1, wild: 5
};
export const deriveTonalCenter = (realm: string, seed?: string): number => {
  if (realm === "wild" && seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const pc = ((h % 12) + 12) % 12;
    return pc > 6 ? pc - 12 : pc;
  }
  return AMBIENCE_REALM_TONAL_CENTER[realm] ?? 0;
};

export const sanitizeAmbience = (raw: unknown): AmbienceInput | null | undefined => {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: AmbienceInput = {};
  if ("space" in r) {
    if (r.space === null) out.space = null;
    else if (typeof r.space === "string" && (AMBIENCE_SPACES as unknown as Set<string>).has(r.space)) out.space = r.space as AmbienceSpace;
  }
  if ("population" in r) {
    if (r.population === null) out.population = null;
    else if (typeof r.population === "string" && (AMBIENCE_POPULATIONS as unknown as Set<string>).has(r.population)) out.population = r.population as AmbiencePopulation;
  }
  if ("mood" in r) {
    if (r.mood === null) out.mood = null;
    else if (typeof r.mood === "string" && (AMBIENCE_MOODS as unknown as Set<string>).has(r.mood)) out.mood = r.mood as AmbienceMood;
  }
  if ("palette" in r) {
    if (r.palette === null) out.palette = null;
    else if (typeof r.palette === "string" && (AMBIENCE_PALETTES as unknown as Set<string>).has(r.palette)) out.palette = r.palette as AmbiencePalette;
  }
  if (Array.isArray(r.events)) {
    const evts = r.events
      .filter((e: unknown) => typeof e === "string" && (AMBIENCE_EVENTS as unknown as Set<string>).has(e))
      .slice(0, 4) as AmbienceEvent[];
    if (evts.length) out.events = evts;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

// ─── Scene ingredient factories (composable layers) ────────────────────
// Each returns { nodes:[...], timers:[...] } compatible with the
// scene-voice disposal protocol in engine._disposeSceneVoice.
function _layerCrickets(eng: AmbienceEngine, dest: AudioNode, density?: number): LayerResult {
  const ctx = eng.ctx;
  const period = 1200 / (density || 1);
  const iv = setInterval(() => {
    if (ctx.state !== "running") return;
    if (Math.random() > 0.7) return;
    const now = ctx.currentTime;
    const chirp = ctx.createOscillator(); chirp.type = "sine";
    chirp.frequency.value = 4200 + Math.random() * 300;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, now);
    const pulses = 2 + Math.floor(Math.random() * 3);
    let t = now;
    for (let p = 0; p < pulses; p++) {
      cg.gain.linearRampToValueAtTime(0.015 + Math.random() * 0.015, t + 0.01);
      cg.gain.linearRampToValueAtTime(0, t + 0.03);
      t += 0.05 + Math.random() * 0.04;
    }
    chirp.connect(cg).connect(dest);
    chirp.start(now); chirp.stop(t + 0.05);
  }, period);
  return { nodes: [], timers: [iv] };
}
function _layerOceanSwell(eng: AmbienceEngine, dest: AudioNode, peak?: number): LayerResult {
  const ctx = eng.ctx;
  const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 400;
  const g = ctx.createGain(); g.gain.value = (peak || 0.15) * 0.4;
  src.connect(f).connect(g).connect(dest); src.start();
  const cycle = () => {
    if (ctx.state !== "running") return;
    g.gain.setTargetAtTime((peak || 0.15), ctx.currentTime, 1.5);
    f.frequency.setTargetAtTime(700, ctx.currentTime, 1.5);
    setTimeout(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime((peak || 0.15) * 0.3, ctx.currentTime, 2.5);
      f.frequency.setTargetAtTime(250, ctx.currentTime, 2.5);
    }, 3500);
  };
  cycle();
  const iv = setInterval(cycle, 8000 + Math.random() * 4000);
  return { nodes: [src, f, g], timers: [iv] };
}
function _layerStreamDrip(eng: AmbienceEngine, dest: AudioNode, peak?: number): LayerResult {
  const ctx = eng.ctx;
  const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 2.5;
  const g = ctx.createGain(); g.gain.value = (peak || 0.10) * 0.5;
  src.connect(f).connect(g).connect(dest); src.start();
  const iv = setInterval(() => {
    if (ctx.state !== "running") return;
    g.gain.setTargetAtTime((peak || 0.10) * (0.5 + Math.random()), ctx.currentTime, 0.8);
    f.frequency.setTargetAtTime(900 + Math.random() * 700, ctx.currentTime, 0.8);
  }, 1200);
  return { nodes: [src, f, g], timers: [iv] };
}
function _layerCafeMurmur(eng: AmbienceEngine, dest: AudioNode, peak?: number): LayerResult {
  const ctx = eng.ctx;
  const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 1.5;
  const g = ctx.createGain(); g.gain.value = (peak || 0.20) * 0.6;
  src.connect(f).connect(g).connect(dest); src.start();
  const iv = setInterval(() => {
    if (ctx.state !== "running") return;
    g.gain.setTargetAtTime((peak || 0.20) * (0.5 + Math.random() * 0.6), ctx.currentTime, 1.5);
    f.frequency.setTargetAtTime(550 + Math.random() * 400, ctx.currentTime, 1.5);
  }, 2400);
  return { nodes: [src, f, g], timers: [iv] };
}
function _layerWindGust(eng: AmbienceEngine, dest: AudioNode): LayerResult {
  const ctx = eng.ctx;
  const iv = setInterval(() => {
    if (ctx.state !== "running") return;
    if (Math.random() > 0.4) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(2.5, "pink");
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = 600; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.35, now + 0.8);
    g.gain.linearRampToValueAtTime(0, now + 2.4);
    src.connect(bp).connect(g).connect(dest);
    src.start(now); src.stop(now + 2.5);
  }, 14000);
  return { nodes: [], timers: [iv] };
}
// Merge children's nodes/timers into the recipe's return value.
function _mergeLayers(...layers: LayerResult[]): LayerResult {
  const nodes: AudioNode[] = [];
  const timers: ReturnType<typeof setInterval>[] = [];
  layers.forEach((l) => {
    if (l.nodes) nodes.push(...l.nodes);
    if (l.timers) timers.push(...l.timers);
  });
  return { nodes, timers };
}

export const AMBIENCE_SPACE_RECIPES: Record<string, (eng: AmbienceEngine, dest: AudioNode) => LayerResult> = {
  intimate: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0.35;
    src.connect(f).connect(g).connect(dest); src.start();
    return { nodes: [src, f, g], timers: [] };
  },
  chamber: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(f).connect(g).connect(dest); src.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      f.frequency.setTargetAtTime(550 + Math.random()*300, ctx.currentTime, 3);
    }, 5000);
    return { nodes: [src, f, g], timers: [iv] };
  },
  hall: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 80;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(lp).connect(hp).connect(g).connect(dest); src.start();
    return { nodes: [src, lp, hp, g], timers: [] };
  },
  cavern: (eng, dest) => {
    // Adapted from Hermes "space" drone, dropped an octave.
    const ctx = eng.ctx;
    const out = ctx.createGain(); out.gain.value = 0.9; out.connect(dest);
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 220;
    lpf.connect(out);
    const freqs = [44, 46, 54.5, 65.4];
    const oscs: AudioNode[] = [];
    freqs.forEach((f) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = 0.18;
      o.connect(og).connect(lpf); o.start();
      oscs.push(o, og);
    });
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      lpf.frequency.setTargetAtTime(120 + Math.random()*200, ctx.currentTime, 4);
    }, 7000);
    const drip = _layerStreamDrip(eng, dest, 0.08);
    return _mergeLayers({ nodes: [out, lpf, ...oscs], timers: [iv] }, drip);
  },
  street: (eng, dest) => {
    // Urban "wind" — bandpass pink noise, slow modulation, plus distant
    // café-murmur layer for a believable street undercurrent.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 550; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.55;
    src.connect(f).connect(g).connect(dest); src.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.4 + Math.random()*0.3, ctx.currentTime, 2);
      f.frequency.setTargetAtTime(400 + Math.random()*400, ctx.currentTime, 2);
    }, 3500);
    const murmur = _layerCafeMurmur(eng, dest, 0.18);
    return _mergeLayers({ nodes: [src, f, g], timers: [iv] }, murmur);
  },
  field: (eng, dest) => {
    // Hermes "wind" recipe + a quiet ocean-cycle swell underneath.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 600; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.55;
    src.connect(f).connect(g).connect(dest); src.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.35 + Math.random()*0.4, ctx.currentTime, 1.5);
      f.frequency.setTargetAtTime(300 + Math.random()*700, ctx.currentTime, 1.5);
    }, 2500);
    const swell = _layerOceanSwell(eng, dest, 0.12);
    return _mergeLayers({ nodes: [src, f, g], timers: [iv] }, swell);
  },
  forest: (eng, dest) => {
    // Soft wind + occasional bird chirps + cricket layer (Hermes-derived).
    const ctx = eng.ctx;
    const wind = ctx.createBufferSource(); wind.buffer = eng._noiseBuffer(3, "pink"); wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 700; wf.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.4;
    wind.connect(wf).connect(wg).connect(dest); wind.start();
    const ivWind = setInterval(() => {
      if (ctx.state !== "running") return;
      wg.gain.setTargetAtTime(0.25 + Math.random()*0.3, ctx.currentTime, 2);
    }, 3000);
    const ivBirds = setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.55) return;
      const now = ctx.currentTime;
      const freq = 3000 + Math.random()*1500;
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(freq * (0.7 + Math.random()*0.5), now + 0.08);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, now);
      og.gain.linearRampToValueAtTime(0.10, now + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      o.connect(og).connect(dest);
      o.start(now); o.stop(now + 0.4);
    }, 1800);
    const crickets = _layerCrickets(eng, dest, 0.6);
    return _mergeLayers({ nodes: [wind, wf, wg], timers: [ivWind, ivBirds] }, crickets);
  },
  vehicle: (eng, dest) => {
    // Confined moving — brown noise rumble + low sine, slow vibrato.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 280;
    const g = ctx.createGain(); g.gain.value = 0.55;
    src.connect(f).connect(g).connect(dest); src.start();
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 58;
    const og = ctx.createGain(); og.gain.value = 0.15;
    o.connect(og).connect(dest); o.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      o.frequency.setTargetAtTime(54 + Math.random()*8, ctx.currentTime, 4);
    }, 6000);
    return { nodes: [src, f, g, o, og], timers: [iv] };
  },
  void: (eng, dest) => {
    // Adapted from Hermes "drone" — detuned mid sines, very slow filter sweep.
    const ctx = eng.ctx;
    const out = ctx.createGain(); out.gain.value = 0.8; out.connect(dest);
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 700;
    lpf.connect(out);
    const freqs = [110, 112, 164.8, 166.2];
    const oscs: AudioNode[] = [];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = 0.12;
      o.connect(og).connect(lpf); o.start();
      oscs.push(o, og);
    });
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      lpf.frequency.setTargetAtTime(400 + Math.random()*500, ctx.currentTime, 4);
    }, 6000);
    return { nodes: [out, lpf, ...oscs], timers: [iv] };
  },
  underwater: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0.55;
    src.connect(lp).connect(g).connect(dest); src.start();
    const freqs = [55, 58, 62];
    const oscs: AudioNode[] = [];
    freqs.forEach((f) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = 0.10;
      o.connect(og).connect(dest); o.start();
      oscs.push(o, og);
    });
    const ivBubble = setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.5) return;
      const now = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(800 + Math.random() * 600, now);
      o.frequency.exponentialRampToValueAtTime(400 + Math.random() * 300, now + 0.15);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, now);
      bg.gain.linearRampToValueAtTime(0.06, now + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o.connect(bg).connect(dest);
      o.start(now); o.stop(now + 0.25);
    }, 2000);
    const ivSweep = setInterval(() => {
      if (ctx.state !== "running") return;
      lp.frequency.setTargetAtTime(200 + Math.random() * 200, ctx.currentTime, 3);
    }, 5000);
    return { nodes: [src, lp, g, ...oscs], timers: [ivBubble, ivSweep] };
  },
  tavern: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.45;
    src.connect(lp).connect(g).connect(dest); src.start();
    const ivCrackle = setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.6) return;
      const now = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const t = now + Math.random() * 0.3;
        const pop = ctx.createBufferSource(); pop.buffer = eng._noiseBuffer(0.04, "brown");
        const plp = ctx.createBiquadFilter(); plp.type = "lowpass"; plp.frequency.value = 800;
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0, t);
        pg.gain.linearRampToValueAtTime(0.08, t + 0.008);
        pg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        pop.connect(plp).connect(pg).connect(dest);
        pop.start(t); pop.stop(t + 0.05);
      }
    }, 1800);
    const murmur = _layerCafeMurmur(eng, dest, 0.22);
    return _mergeLayers({ nodes: [src, lp, g], timers: [ivCrackle] }, murmur);
  }
};

export const AMBIENCE_POPULATION_RECIPES: Record<string, (eng: AmbienceEngine, dest: AudioNode) => LayerResult> = {
  solitary: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 350;
    const g = ctx.createGain(); g.gain.value = 0.40;
    src.connect(f).connect(g).connect(dest); src.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.25 + Math.random()*0.25, ctx.currentTime, 3);
    }, 5000);
    return { nodes: [src, f, g], timers: [iv] };
  },
  sparse_voices: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.0;
    const g = ctx.createGain(); g.gain.value = 0.30;
    src.connect(f).connect(g).connect(dest); src.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.15 + Math.random()*0.3, ctx.currentTime, 1.5);
      f.frequency.setTargetAtTime(700 + Math.random()*500, ctx.currentTime, 1.5);
    }, 2200);
    return { nodes: [src, f, g], timers: [iv] };
  },
  crowd: (eng, dest) => {
    // Voice-band bandpassed pink with faster modulation than sparse_voices.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.value = 0.45;
    src.connect(f).connect(g).connect(dest); src.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.3 + Math.random()*0.35, ctx.currentTime, 0.7);
      f.frequency.setTargetAtTime(500 + Math.random()*700, ctx.currentTime, 0.7);
    }, 900);
    return { nodes: [src, f, g], timers: [iv] };
  },
  machinery: (eng, dest) => {
    // Low rumble + low sine + irregular clicks.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 450;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(f).connect(g).connect(dest); src.start();
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 92;
    const og = ctx.createGain(); og.gain.value = 0.12;
    o.connect(og).connect(dest); o.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const click = ctx.createOscillator(); click.type = "triangle"; click.frequency.value = 300 + Math.random()*200;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, now);
      cg.gain.linearRampToValueAtTime(0.04, now + 0.03);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      click.connect(cg).connect(dest);
      click.start(now); click.stop(now + 0.1);
    }, 700);
    return { nodes: [src, f, g, o, og], timers: [iv] };
  },
  nature: (eng, dest) => {
    // Hermes crickets + birds + stream layered.
    const ctx = eng.ctx;
    const stream = ctx.createBufferSource(); stream.buffer = eng._noiseBuffer(3, "pink"); stream.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.value = 1200; sf.Q.value = 2;
    const sg = ctx.createGain(); sg.gain.value = 0.25;
    stream.connect(sf).connect(sg).connect(dest); stream.start();
    const ivStream = setInterval(() => {
      if (ctx.state !== "running") return;
      sg.gain.setTargetAtTime(0.15 + Math.random()*0.2, ctx.currentTime, 0.8);
      sf.frequency.setTargetAtTime(900 + Math.random()*700, ctx.currentTime, 0.8);
    }, 900);
    const ivCrickets = setInterval(() => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const chirp = ctx.createOscillator(); chirp.type = "sine"; chirp.frequency.value = 4200 + Math.random()*300;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, now);
      const pulses = 3 + Math.floor(Math.random()*3);
      let t = now;
      for (let p = 0; p < pulses; p++) {
        cg.gain.linearRampToValueAtTime(0.015 + Math.random()*0.015, t + 0.01);
        cg.gain.linearRampToValueAtTime(0, t + 0.03);
        t += 0.05 + Math.random()*0.04;
      }
      chirp.connect(cg).connect(dest);
      chirp.start(now); chirp.stop(t + 0.05);
    }, 1200);
    const ivBirds = setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.5) return;
      const now = ctx.currentTime;
      const freq = 3000 + Math.random()*1500;
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(freq * (0.7 + Math.random()*0.5), now + 0.08);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, now);
      og.gain.linearRampToValueAtTime(0.08, now + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      o.connect(og).connect(dest);
      o.start(now); o.stop(now + 0.4);
    }, 900);
    return { nodes: [stream, sf, sg], timers: [ivStream, ivCrickets, ivBirds] };
  },
  ceremony: (eng, dest) => {
    // Low chord drone (root + fifth + octave).
    const ctx = eng.ctx;
    const out = ctx.createGain(); out.gain.value = 0.6; out.connect(dest);
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 500;
    lpf.connect(out);
    const freqs = [130, 195, 260];
    const oscs: AudioNode[] = [];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = 0.10;
      o.connect(og).connect(lpf); o.start();
      oscs.push(o, og);
    });
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      lpf.frequency.setTargetAtTime(350 + Math.random()*400, ctx.currentTime, 4);
    }, 8000);
    return { nodes: [out, lpf, ...oscs], timers: [iv] };
  },
  creature: (eng, dest) => {
    // Low brown rumble + ~70Hz growl, slow detune.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "brown"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220;
    const g = ctx.createGain(); g.gain.value = 0.4;
    src.connect(f).connect(g).connect(dest); src.start();
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 72;
    const og = ctx.createGain(); og.gain.value = 0.10;
    o.connect(og).connect(dest); o.start();
    const iv = setInterval(() => {
      if (ctx.state !== "running") return;
      o.frequency.setTargetAtTime(60 + Math.random()*30, ctx.currentTime, 1.5);
      g.gain.setTargetAtTime(0.25 + Math.random()*0.3, ctx.currentTime, 1.5);
    }, 2500);
    return { nodes: [src, f, g, o, og], timers: [iv] };
  },
  wild: (eng, dest) => {
    // Hermes "ocean" cycle + intermittent distant thunder.
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0.4;
    src.connect(f).connect(g).connect(dest); src.start();
    const cycle = () => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.6, ctx.currentTime, 1.2);
      f.frequency.setTargetAtTime(900, ctx.currentTime, 1.2);
      setTimeout(() => {
        if (ctx.state !== "running") return;
        g.gain.setTargetAtTime(0.2, ctx.currentTime, 2.5);
        f.frequency.setTargetAtTime(250, ctx.currentTime, 2.5);
      }, 3500);
    };
    cycle();
    const ivOcean = setInterval(cycle, 7000 + Math.random()*3000);
    const ivThunder = setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.45) return;
      const now = ctx.currentTime;
      const dur = 2 + Math.random()*2;
      const t = ctx.createBufferSource(); t.buffer = eng._noiseBuffer(dur, "white");
      const tf = ctx.createBiquadFilter(); tf.type = "lowpass"; tf.frequency.value = 180;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0, now);
      tg.gain.linearRampToValueAtTime(0.5, now + 0.25);
      tg.gain.exponentialRampToValueAtTime(0.001, now + dur);
      t.connect(tf).connect(tg).connect(dest);
      t.start(now); t.stop(now + dur + 0.5);
    }, 9000);
    const gusts = _layerWindGust(eng, dest);
    return _mergeLayers({ nodes: [src, f, g], timers: [ivOcean, ivThunder] }, gusts);
  },
  spirits: (eng, dest) => {
    const ctx = eng.ctx;
    const out = ctx.createGain(); out.gain.value = 0.5; out.connect(dest);
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 500;
    lpf.connect(out);
    const freqs = [180, 220, 280, 380];
    const oscs: AudioNode[] = [];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      o.detune.value = (i % 2 ? 5 : -5);
      const og = ctx.createGain(); og.gain.value = 0.08;
      o.connect(og).connect(lpf); o.start();
      oscs.push(o, og);
    });
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.15;
    const lfoG = ctx.createGain(); lfoG.gain.value = 80;
    lfo.connect(lfoG);
    oscs.forEach((n, i) => { if (i % 2 === 0) lfoG.connect((n as OscillatorNode).frequency); });
    lfo.start();
    const ivPuff = setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.4) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.6, "pink");
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 600; bp.Q.value = 2;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0, now);
      pg.gain.linearRampToValueAtTime(0.05, now + 0.1);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      src.connect(bp).connect(pg).connect(dest);
      src.start(now); src.stop(now + 0.6);
    }, 4000);
    return { nodes: [out, lpf, lfo, lfoG, ...oscs], timers: [ivPuff] };
  },
  rain: (eng, dest) => {
    const ctx = eng.ctx;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(3, "pink"); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.45;
    src.connect(bp).connect(g).connect(dest); src.start();
    const ivDensity = setInterval(() => {
      if (ctx.state !== "running") return;
      g.gain.setTargetAtTime(0.30 + Math.random() * 0.30, ctx.currentTime, 2.5);
      bp.frequency.setTargetAtTime(2000 + Math.random() * 2000, ctx.currentTime, 2.5);
    }, 5000);
    return { nodes: [src, bp, g], timers: [ivDensity] };
  }
};

export const AMBIENCE_EVENT_RECIPES: Record<string, (eng: AmbienceEngine, startAt: number) => void> = {
  bell_toll: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    [[110, 0.50], [220, 0.30], [330, 0.12]].forEach(([f, peak]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, startAt);
      og.gain.linearRampToValueAtTime(peak, startAt + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0005, startAt + 2.5);
      o.connect(og).connect(dest);
      o.start(startAt); o.stop(startAt + 2.6);
    });
  },
  bell_distant: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 1200;
    lpf.connect(dest);
    [[220, 0.30], [440, 0.15]].forEach(([f, peak]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, startAt);
      og.gain.linearRampToValueAtTime(peak, startAt + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0005, startAt + 1.8);
      o.connect(og).connect(lpf);
      o.start(startAt); o.stop(startAt + 1.9);
    });
    setTimeout(() => { try { lpf.disconnect(); } catch (_) {} }, 2200);
  },
  clock_chime: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    [[523, 0.40], [783, 0.20]].forEach(([f, peak]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, startAt);
      og.gain.linearRampToValueAtTime(peak, startAt + 0.005);
      og.gain.exponentialRampToValueAtTime(0.0005, startAt + 1.3);
      o.connect(og).connect(dest);
      o.start(startAt); o.stop(startAt + 1.4);
    });
  },
  door_close: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.4, "brown");
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.65, startAt + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.4);
    src.connect(f).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 0.45);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 70;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, startAt);
    og.gain.linearRampToValueAtTime(0.45, startAt + 0.008);
    og.gain.exponentialRampToValueAtTime(0.001, startAt + 0.3);
    o.connect(og).connect(dest);
    o.start(startAt); o.stop(startAt + 0.35);
  },
  door_creak: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.5, "pink");
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2.5;
    f.frequency.setValueAtTime(450, startAt);
    f.frequency.linearRampToValueAtTime(750, startAt + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.35, startAt + 0.15);
    g.gain.setTargetAtTime(0.001, startAt + 0.5, 0.4);
    src.connect(f).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.5);
  },
  footsteps_close: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    [0, 0.42].forEach((offset) => {
      const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.18, "brown");
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, startAt + offset);
      g.gain.linearRampToValueAtTime(0.55, startAt + offset + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, startAt + offset + 0.16);
      src.connect(f).connect(g).connect(dest);
      src.start(startAt + offset); src.stop(startAt + offset + 0.2);
    });
  },
  footsteps_recede: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    [[0, 0.50], [0.40, 0.30], [0.80, 0.15]].forEach(([offset, peak]) => {
      const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.16, "brown");
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, startAt + offset);
      g.gain.exponentialRampToValueAtTime(0.001, startAt + offset + 0.14);
      src.connect(f).connect(g).connect(dest);
      src.start(startAt + offset); src.stop(startAt + offset + 0.18);
    });
  },
  wind_gust: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.8, "pink");
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 250;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.50, startAt + 0.5);
    g.gain.linearRampToValueAtTime(0, startAt + 1.7);
    src.connect(hp).connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.8);
  },
  distant_thunder: (eng, startAt) => {
    // Adapted from Hermes "thunder".
    const ctx = eng.ctx, dest = eng.master;
    const dur = 2.8;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(dur, "white");
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.45, startAt + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + dur + 0.1);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 45;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, startAt);
    og.gain.linearRampToValueAtTime(0.15, startAt + 0.3);
    og.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
    o.connect(og).connect(dest);
    o.start(startAt); o.stop(startAt + dur + 0.1);
  },
  paper_rustle: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.55, "pink");
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2000;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4500; bp.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.40, startAt + 0.02);
    g.gain.linearRampToValueAtTime(0, startAt + 0.5);
    src.connect(hp).connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 0.55);
  },
  chair_scrape: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.7, "brown");
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 350; f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.35, startAt + 0.02);
    g.gain.linearRampToValueAtTime(0, startAt + 0.7);
    src.connect(f).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 0.75);
  },
  glass_set_down: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.1, "pink");
    const tf = ctx.createBiquadFilter(); tf.type = "bandpass"; tf.frequency.value = 1500; tf.Q.value = 2;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.55, startAt);
    tg.gain.exponentialRampToValueAtTime(0.001, startAt + 0.08);
    src.connect(tf).connect(tg).connect(dest);
    src.start(startAt); src.stop(startAt + 0.1);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 1600;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, startAt);
    og.gain.linearRampToValueAtTime(0.18, startAt + 0.01);
    og.gain.exponentialRampToValueAtTime(0.001, startAt + 0.5);
    o.connect(og).connect(dest);
    o.start(startAt); o.stop(startAt + 0.55);
  },
  coin_drop: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2800; bp.Q.value = 2;
    bp.connect(dest);
    [[2400, 0.35], [3600, 0.18]].forEach(([f, peak]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, startAt);
      og.gain.linearRampToValueAtTime(peak, startAt + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0005, startAt + 0.55);
      o.connect(og).connect(bp);
      o.start(startAt); o.stop(startAt + 0.6);
    });
    setTimeout(() => { try { bp.disconnect(); } catch (_) {} }, 700);
  },
  crowd_hush: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.2, "pink");
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 600; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.45, startAt + 0.008);
    g.gain.setValueAtTime(0.45, startAt + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 1.1);
    src.connect(f).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.2);
  },
  cough_distant: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.35, "pink");
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.35, startAt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.32);
    src.connect(f).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 0.35);
  },
  breath_held: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.5, "pink");
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 300;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 800; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.30, startAt + 0.4);
    g.gain.linearRampToValueAtTime(0, startAt + 1.5);
    src.connect(hp).connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.5);
  },
  metal_clang: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    [[440, 0.32], [659, 0.25], [880, 0.15]].forEach(([f, peak]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, startAt);
      og.gain.linearRampToValueAtTime(peak, startAt + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0005, startAt + 1.2);
      o.connect(og).connect(dest);
      o.start(startAt); o.stop(startAt + 1.3);
    });
  },
  whisper_close: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.0, "pink");
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.22, startAt + 0.05);
    g.gain.setValueAtTime(0.22, startAt + 0.7);
    g.gain.linearRampToValueAtTime(0, startAt + 1.0);
    src.connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.0);
  },
  rain_patter: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.8, "pink");
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 1.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.30, startAt + 0.5);
    g.gain.setValueAtTime(0.30, startAt + 1.0);
    g.gain.linearRampToValueAtTime(0, startAt + 1.5);
    src.connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.8);
  },
  fire_crackle: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    for (let i = 0; i < 4; i++) {
      const t = startAt + Math.random() * 0.3;
      const pop = ctx.createBufferSource(); pop.buffer = eng._noiseBuffer(0.06, "brown");
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0, t);
      pg.gain.linearRampToValueAtTime(0.15, t + 0.008);
      pg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      pop.connect(lp).connect(pg).connect(dest);
      pop.start(t); pop.stop(t + 0.07);
    }
  },
  water_drip: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(1200, startAt);
    o.frequency.exponentialRampToValueAtTime(800, startAt + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.20, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.3);
    o.connect(g).connect(dest);
    o.start(startAt); o.stop(startAt + 0.35);
  },
  heartbeat: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    [0, 0.18].forEach((offset) => {
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(80, startAt + offset);
      o.frequency.exponentialRampToValueAtTime(40, startAt + offset + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, startAt + offset);
      g.gain.linearRampToValueAtTime(0.25, startAt + offset + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, startAt + offset + 0.2);
      o.connect(g).connect(dest);
      o.start(startAt + offset); o.stop(startAt + offset + 0.25);
    });
  },
  keys_jingle: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const freqs = [2200, 2700, 3200];
    freqs.forEach((f, i) => {
      const t = startAt + i * 0.06;
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(dest);
      o.start(t); o.stop(t + 0.3);
    });
  },
  horse_hooves: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const peaks = [0.30, 0.25, 0.20, 0.15];
    peaks.forEach((p, i) => {
      const t = startAt + i * 0.22;
      const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.08, "brown");
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(lp).connect(g).connect(dest);
      src.start(t); src.stop(t + 0.1);
    });
  },
  owl_hoot: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(480, startAt);
    o.frequency.exponentialRampToValueAtTime(340, startAt + 1.0);
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 15;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.15, startAt + 0.08);
    g.gain.setValueAtTime(0.15, startAt + 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 1.2);
    o.connect(g).connect(dest);
    o.start(startAt); o.stop(startAt + 1.3);
    lfo.start(startAt); lfo.stop(startAt + 1.3);
  },
  sword_draw: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.6, "white");
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(1000, startAt);
    bp.frequency.exponentialRampToValueAtTime(4000, startAt + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.30, startAt + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.5);
    src.connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 0.6);
  },
  book_page_turn: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(0.4, "pink");
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.12, startAt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.3);
    src.connect(hp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 0.4);
  },
  lock_click: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.25, startAt + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.04);
    o.connect(g).connect(dest);
    o.start(startAt); o.stop(startAt + 0.06);
  },
  crowd_cheer: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.8, "pink");
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 800; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.35, startAt + 0.6);
    g.gain.setValueAtTime(0.35, startAt + 1.0);
    g.gain.linearRampToValueAtTime(0, startAt + 1.5);
    src.connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.8);
  },
  sigh_close: (eng, startAt) => {
    const ctx = eng.ctx, dest = eng.master;
    const src = ctx.createBufferSource(); src.buffer = eng._noiseBuffer(1.0, "pink");
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(800, startAt);
    bp.frequency.exponentialRampToValueAtTime(500, startAt + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.18, startAt + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + 0.8);
    src.connect(bp).connect(g).connect(dest);
    src.start(startAt); src.stop(startAt + 1.0);
  }
};
