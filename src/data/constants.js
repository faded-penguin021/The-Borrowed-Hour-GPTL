// @ts-check
/**
 * @import { AppSettings, CodexMode, CodexSettings, EndingType, EngineConfig, GameState, SizeEstimate } from "../types"
 */
export var SAVE_PREFIX = "borrowed:save:";
export var SETTINGS_KEY = "borrowed:settings:v1";
export var ONBOARDING_KEY = "borrowed:onboarding:v1";
export var SAVE_CAP = 30;
export var APPROX_CHARS_PER_TOKEN = 3.5;

/**
 * @param {unknown} value
 * @returns {SizeEstimate}
 */
export var estimateSize = (value) => {
  let bytes = 0;
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

/**
 * @param {number} kb
 * @returns {string}
 */
export var formatKB = (kb) => {
  if (kb < 1)
    return `${Math.round(kb * 1024)} B`;
  if (kb < 100)
    return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
};

/**
 * @param {number} t
 * @returns {string}
 */
export var formatTokens = (t) => {
  if (t < 1000)
    return `~${t} tokens`;
  return `~${(t / 1000).toFixed(t < 1e4 ? 1 : 0)}K tokens`;
};

/** @type {EngineConfig} */
export var DEFAULT_ENGINE_OPENING = { provider: "mistral", model: "mistral-large-latest" };
/** @type {EngineConfig} */
export var DEFAULT_ENGINE_GM = { provider: "mistral", model: "mistral-medium-latest" };
/** @type {EngineConfig} */
export var DEFAULT_ENGINE_NARRATOR = { provider: "mistral", model: "mistral-medium-latest" };

// Canonical illustration-frequency choices, shared by the settings UI and kept
// in lock-step with the `CodexMode` type and the `useCodex` runtime. The `id`
// fields are annotated as `CodexMode`, so tsc fails the build if this list and
// the type ever drift apart again (the original bug this guards against).
/** @type {{ id: CodexMode, label: string, hint: string }[]} */
export var CODEX_MODE_OPTIONS = [
  { id: "off",         label: "Off",         hint: "No illustrations. The text stands alone." },
  { id: "key_moments", label: "Key moments", hint: "The Art Director gates plates to milestones." },
  { id: "always",      label: "Always",      hint: "A plate every turn — counter to the codex feel." }
];

/** @type {CodexSettings} */
export var DEFAULT_CODEX_SETTINGS = {
  mode: "off",
  provider: "pollinations",
  providerConfig: {
    pollinations: { model: "flux" },
    replicate: { model: "black-forest-labs/flux-schnell" },
    openai: { model: "gpt-image-1-mini" },
    local: {}
  },
  artDirectorEngine: { provider: "mistral", model: "mistral-small-latest" },
  maxPerSession: 12,
  timeoutMs: 60000
};

/** @type {AppSettings} */
export var DEFAULT_SETTINGS = {
  highContrast: false,
  disableTypewriter: false,
  streamNarration: true,
  engineStack: "free",
  freeModelSelection: false,
  engineOpening: DEFAULT_ENGINE_OPENING,
  engineGM: DEFAULT_ENGINE_GM,
  engineNarrator: DEFAULT_ENGINE_NARRATOR,
  codex: DEFAULT_CODEX_SETTINGS,
  proxyUrl: ""
};

export var LOCAL_DEFAULT_URL = "http://localhost:11434/v1/chat/completions";

/** @type {GameState} */
export var EMPTY_STATE = {
  scene: "",
  time: "",
  inventory: [],
  npcs: [],
  clues: [],
  summary: "",
  hidden_state: ""
};

export var VALID_ENDINGS = /** @type {Set<EndingType>} */ (/** @type {unknown} */ (new Set(["good", "bittersweet", "pyrrhic", "ambiguous", "bad"])));
