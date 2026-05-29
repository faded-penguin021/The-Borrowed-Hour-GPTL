// Single source of truth for the ambience taxonomy.
// Consumed by both the engine (ambience/tables.js validation Sets) and the
// GM tool schemas (llm/tools.js enum arrays). Adding a new value here makes
// it available to both the LLM and the audio engine at once.

export var AMBIENCE_SPACE_VALUES = [
  "intimate", "chamber", "hall", "cavern",
  "street", "field", "forest", "vehicle", "void"
];

export var AMBIENCE_POPULATION_VALUES = [
  "solitary", "sparse_voices", "crowd", "machinery",
  "nature", "ceremony", "creature", "wild"
];

export var AMBIENCE_MOOD_VALUES = [
  "calm", "tender", "tense", "ominous",
  "joyous", "melancholy", "urgent", "mysterious"
];

// Sonic palette — the instrument family / timbre the music is voiced with.
// Held across turns like space/mood. While `mood` drives the musical CONTENT
// (scale, chords, tempo, beat pattern), `palette` drives the TIMBRE (which
// instruments sound and how), so the same mood reads very differently in a
// neon back-alley (synth) versus a devotional fresco (choir). The GM picks the
// palette to match the setting; omit to hold the previous value.
export var AMBIENCE_PALETTE_VALUES = [
  "strings", "piano", "synth", "glass",
  "choir", "reed", "brass", "guitar"
];

export var AMBIENCE_EVENT_VALUES = [
  "bell_toll", "bell_distant", "clock_chime",
  "door_close", "door_creak",
  "footsteps_close", "footsteps_recede",
  "wind_gust", "distant_thunder",
  "paper_rustle", "chair_scrape", "glass_set_down", "coin_drop",
  "crowd_hush", "cough_distant", "breath_held",
  "metal_clang", "whisper_close"
];
