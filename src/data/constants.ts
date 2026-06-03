import type {
  AppSettings, CodexMode, CodexSettings, EndingType, EngineConfig, GameState, SizeEstimate
} from "../types";

export const SAVE_PREFIX = "borrowed:save:";
export const SETTINGS_KEY = "borrowed:settings:v1";
export const ONBOARDING_KEY = "borrowed:onboarding:v1";
export const SAVE_CAP = 30;
export const APPROX_CHARS_PER_TOKEN = 3.5;

export const estimateSize = (value: unknown): SizeEstimate => {
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

export const formatKB = (kb: number): string => {
  if (kb < 1)
    return `${Math.round(kb * 1024)} B`;
  if (kb < 100)
    return `${kb.toFixed(1)} KB`;
  return `${Math.round(kb)} KB`;
};

export const formatTokens = (t: number): string => {
  if (t < 1000)
    return `~${t} tokens`;
  return `~${(t / 1000).toFixed(t < 1e4 ? 1 : 0)}K tokens`;
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
    pollinations: { model: "flux" },
    replicate: { model: "black-forest-labs/flux-schnell" },
    openai: { model: "gpt-image-1" },
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

export const VALID_ENDINGS: Set<EndingType> = new Set<EndingType>([
  "good", "bittersweet", "pyrrhic", "ambiguous", "bad"
]);
