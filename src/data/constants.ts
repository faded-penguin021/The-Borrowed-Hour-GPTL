import type {
  AppSettings, CodexMode, CodexSettings, EndingType, EngineConfig, GameState, SizeEstimate,
  StoryLedger
} from "../types";

export const SAVE_PREFIX = "borrowed:save:";
// The single autosave slot. Deliberately outside SAVE_PREFIX so it never shows
// up in the manual saves list, yet the storage shim still routes it to
// IndexedDB (see storage/shim.ts) so a long chronicle can't blow the
// localStorage cap.
export const AUTOSAVE_KEY = "borrowed:autosave:v1";
export const SETTINGS_KEY = "borrowed:settings:v1";
export const ONBOARDING_KEY = "borrowed:onboarding:v1";
export const SAVE_CAP = 30;
export const APPROX_CHARS_PER_TOKEN = 3.5;

export const estimateSize = (value: unknown): SizeEstimate => {
  let bytes: number;
  try {
    bytes = typeof value === "string" ? value.length : JSON.stringify(value).length;
  } catch {
    bytes = 0;
  }
  return {
    bytes,
    kb: bytes / 1024,
    tokens: Math.round(bytes / APPROX_CHARS_PER_TOKEN)
  };
};

export const formatKB = (kb: number): string => {
  if (kb < 1)
    return `${Math.round(kb * 1024)} B`;
  if (kb < 100)
    return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
};

export const formatTokens = (t: number, approximate = false): string => {
  const prefix = approximate ? "~" : "";
  if (t < 1000)
    return `${prefix}${t} tokens`;
  return `${prefix}${(t / 1000).toFixed(t < 1e4 ? 1 : 0)}K tokens`;
};

export const DEFAULT_ENGINE_OPENING: EngineConfig = { provider: "mistral", model: "mistral-large-latest" };
export const DEFAULT_ENGINE_GM: EngineConfig = { provider: "mistral", model: "mistral-medium-latest" };
export const DEFAULT_ENGINE_NARRATOR: EngineConfig = { provider: "mistral", model: "mistral-medium-latest" };

// Canonical illustration-frequency choices, shared by the settings UI and kept
// in lock-step with the `CodexMode` type and the `useCodex` runtime. The `id`
// fields are annotated as `CodexMode`, so tsc fails the build if this list and
// the type ever drift apart again (the original bug this guards against).
export const CODEX_MODE_OPTIONS: { id: CodexMode; label: string; hint: string }[] = [
  { id: "off",         label: "Off",         hint: "No illustrations. The text stands alone." },
  { id: "key_moments", label: "Key moments", hint: "The Art Director gates plates to milestones." },
  { id: "always",      label: "Always",      hint: "A plate every turn — counter to the codex feel." }
];

export const DEFAULT_CODEX_SETTINGS: CodexSettings = {
  mode: "off",
  provider: "pollinations",
  providerConfig: {
    pollinations: { model: "sana" },
    replicate: { model: "black-forest-labs/flux-schnell" },
    openai: { model: "gpt-image-2" },
    local: {}
  },
  artDirectorEngine: { provider: "mistral", model: "mistral-small-latest" },
  maxPerSession: 12,
  timeoutMs: 60000
};

export const DEFAULT_SETTINGS: AppSettings = {
  highContrast: false,
  disableTypewriter: false,
  streamNarration: true,
  debugOverlay: false,
  engineStack: "free",
  freeModelSelection: false,
  engineOpening: DEFAULT_ENGINE_OPENING,
  engineGM: DEFAULT_ENGINE_GM,
  engineNarrator: DEFAULT_ENGINE_NARRATOR,
  codex: DEFAULT_CODEX_SETTINGS,
  proxyUrl: ""
};

export const LOCAL_DEFAULT_URL = "http://localhost:11434/v1/chat/completions";

export const EMPTY_STATE: GameState = {
  scene: "",
  time: "",
  inventory: [],
  npcs: [],
  clues: [],
  summary: "",
  hidden_state: ""
};

// ── Permanent-memory bounds ──────────────────────────────────────────────────
// The ledger is injected into every turn's prompt, so it is a tier the model
// must read and therefore a tier that has to be bounded. The three numbers live
// here together rather than beside their uses: a threshold you cannot find is a
// threshold nobody tunes.
//
// The row cap TRUNCATES rather than rejects, which is a deliberate departure
// from how the repo's own docs/LEDGER.md cap works. There the author can be told
// to rewrite; here the author is a model mid-turn that gets no second pass, and
// dropping an over-long row loses the fact outright. Half a fact beats none.
export const LEDGER_ROW_CHAR_CAP = 240;
// Rows held verbatim. Past this, the oldest batch folds into the chronicle.
export const LEDGER_MAX_ROWS = 60;
// Folded per rollover. Batching keeps the fold rare instead of once per turn.
export const LEDGER_ROLLOVER_BATCH = 20;
// Rows one turn may add. Without a bound, a single GM reply can fold rows from
// the very turn it is playing -- and an undo of that turn cannot retract them,
// because the chronicle is frozen. Also what stops one turn flooding the tier.
export const LEDGER_MAX_ROWS_PER_TURN = 6;
// The frozen chronicle's ceiling, enforced as it is folded rather than at the
// storage boundary. A cap applied only on load trims the newest folded text a
// little more on every save/load cycle; enforced here, the in-memory value and
// the stored one are the same value and the round trip is idempotent.
export const LEDGER_CHRONICLE_CHAR_CAP = 20_000;
// What the chronicle may spend of a PROMPT, which is a different budget from
// what it may spend of a save. The block lands in the last user message, which
// the history pruner can never drop (it is inside MIN_TAIL), so at the storage
// cap the tier alone could take 20 KB of a 60 KB request on the tightest
// provider -- eating more of the budget than the pruning it exists to survive.
// Trimmed at render, never in storage: the folded text stays whole on disk.
export const LEDGER_PROMPT_CHRONICLE_CHAR_CAP = 4_000;

// Consecutive words that must coincide before the continuity rules call a
// private note "present" in the prose or the public state. Long enough that a
// match is not coincidence in ordinary writing; short enough to catch a
// sentence copied across. Lowering it buys false positives, not sensitivity --
// a paraphrase evades any value of this, which is a limit of the approach
// rather than of the number.
export const CONTINUITY_LEAK_NGRAM_WORDS = 6;

export const EMPTY_LEDGER: StoryLedger = {
  rows: [],
  chronicle: "",
  rolled: 0
};

export const VALID_ENDINGS: Set<EndingType> = new Set<EndingType>([
  "good", "bittersweet", "pyrrhic", "ambiguous", "bad"
]);
