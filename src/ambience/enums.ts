import type { AmbienceEvent, AmbienceMood, AmbiencePalette, AmbiencePopulation, AmbienceSpace } from "../types";
// Single source of truth for the ambience taxonomy.
// Consumed by both the engine (ambience/tables.js validation Sets) and the
// GM tool schemas (llm/tools.js enum arrays). Adding a new value here makes
// it available to both the LLM and the audio engine at once.

export const AMBIENCE_SPACE_VALUES: AmbienceSpace[] = [
  "intimate", "chamber", "hall", "cavern",
  "street", "field", "forest", "vehicle", "void"
];

export const AMBIENCE_POPULATION_VALUES: AmbiencePopulation[] = [
  "solitary", "sparse_voices", "crowd", "machinery",
  "nature", "ceremony", "creature", "wild"
];

export const AMBIENCE_MOOD_VALUES: AmbienceMood[] = [
  "calm", "tender", "tense", "ominous",
  "joyous", "melancholy", "urgent", "mysterious"
];

// Sonic palette — the instrument family / timbre the music is voiced with.
// Held across turns like space/mood. While `mood` drives the musical CONTENT
// (scale, chords, tempo, beat pattern), `palette` drives the TIMBRE (which
// instruments sound and how), so the same mood reads very differently in a
// neon back-alley (synth) versus a devotional fresco (choir). The GM picks the
// palette to match the setting; omit to hold the previous value.
export const AMBIENCE_PALETTE_VALUES: AmbiencePalette[] = [
  "strings", "piano", "synth", "glass",
  "choir", "reed", "brass", "guitar"
];

export const AMBIENCE_EVENT_VALUES: AmbienceEvent[] = [
  "bell_toll", "bell_distant", "clock_chime",
  "door_close", "door_creak",
  "footsteps_close", "footsteps_recede",
  "wind_gust", "distant_thunder",
  "paper_rustle", "chair_scrape", "glass_set_down", "coin_drop",
  "crowd_hush", "cough_distant", "breath_held",
  "metal_clang", "whisper_close"
];
