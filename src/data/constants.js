export var SAVE_PREFIX = "borrowed:save:";
export var SETTINGS_KEY = "borrowed:settings:v1";
export var SAVE_CAP = 30;
export var APPROX_CHARS_PER_TOKEN = 3.5;

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

export var formatKB = (kb) => {
  if (kb < 1)
    return `${Math.round(kb * 1024)} B`;
  if (kb < 100)
    return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
};

export var formatTokens = (t) => {
  if (t < 1000)
    return `~${t} tokens`;
  return `~${(t / 1000).toFixed(t < 1e4 ? 1 : 0)}K tokens`;
};

export var DEFAULT_ENGINE_OPENING = { provider: "mistral", model: "mistral-large-latest" };
export var DEFAULT_ENGINE_GM = { provider: "mistral", model: "mistral-medium-latest" };
export var DEFAULT_ENGINE_NARRATOR = { provider: "mistral", model: "mistral-medium-latest" };

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
  timeoutMs: 20000
};

export var DEFAULT_SETTINGS = {
  highContrast: false,
  disableTypewriter: false,
  streamNarration: true,
  engineStack: "free",
  freeModelSelection: false,
  engineOpening: DEFAULT_ENGINE_OPENING,
  engineGM: DEFAULT_ENGINE_GM,
  engineNarrator: DEFAULT_ENGINE_NARRATOR,
  codex: DEFAULT_CODEX_SETTINGS
};

export var LOCAL_DEFAULT_URL = "http://localhost:11434/v1/chat/completions";

export var EMPTY_STATE = {
  scene: "",
  time: "",
  inventory: [],
  npcs: [],
  clues: [],
  summary: "",
  hidden_state: ""
};

export var VALID_ENDINGS = new Set(["good", "bittersweet", "pyrrhic", "ambiguous", "bad"]);
