// Ambient type definitions for The Borrowed Hour.
// All types are globally available — no import needed in JS files.
// Add // @ts-check to any .js file to opt in to type checking.

// ── Ambience ─────────────────────────────────────────────────────────────────

type AmbienceSpace =
  | "intimate" | "chamber" | "hall" | "cavern"
  | "street" | "field" | "forest" | "vehicle" | "void";

type AmbiencePopulation =
  | "solitary" | "sparse_voices" | "crowd" | "machinery"
  | "nature" | "ceremony" | "creature" | "wild";

type AmbienceMood =
  | "calm" | "tender" | "tense" | "ominous"
  | "joyous" | "melancholy" | "urgent" | "mysterious";

type AmbiencePalette =
  | "strings" | "piano" | "synth" | "glass"
  | "choir" | "reed" | "brass" | "guitar";

type AmbienceEvent =
  | "bell_toll" | "bell_distant" | "clock_chime"
  | "door_close" | "door_creak"
  | "footsteps_close" | "footsteps_recede"
  | "wind_gust" | "distant_thunder"
  | "paper_rustle" | "chair_scrape" | "glass_set_down" | "coin_drop"
  | "crowd_hush" | "cough_distant" | "breath_held"
  | "metal_clang" | "whisper_close";

interface AmbienceInput {
  space?: AmbienceSpace;
  population?: AmbiencePopulation;
  mood?: AmbienceMood;
  palette?: AmbiencePalette;
  events?: AmbienceEvent[];
}

// ── Core game types ───────────────────────────────────────────────────────────

interface NPC {
  name: string;
  note: string;
}

interface GameState {
  scene: string;
  time: string;
  inventory: string[];
  npcs: NPC[];
  clues: string[];
  summary: string;
  hidden_state: string;
}

type EndingType = "good" | "bittersweet" | "pyrrhic" | "ambiguous" | "bad";

interface NarrationEntry {
  type: "narration";
  text: string;
  fullyRevealed: boolean;
  streaming?: boolean;
  illustration?: Illustration;
}

interface ActionEntry {
  type: "action";
  text: string;
  fullyRevealed: boolean;
  role?: "user" | "assistant";
  streaming?: boolean;
  illustration?: Illustration;
}

type Entry = NarrationEntry | ActionEntry;

interface Premise {
  id: string;
  realm: string;
  realmLabel: string;
  title: string;
  teaser: string;
  seed: string;
  gmNote: string;
  isCustom?: boolean;
}

// ── LLM provider types ────────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  label?: string;
  tier?: string;
  isFree?: boolean;
}

type ProviderId =
  | "gemini" | "openai" | "anthropic" | "deepseek"
  | "qwen" | "kimi" | "ernie" | "mistral"
  | "groq" | "openrouter" | "cerebras" | "local";

interface ProviderMeta {
  name: string;
  keyStorage: string;
  windowKey: string;
  metaName: string;
  models: ModelEntry[];
  keyOptional?: boolean;
  urlStorage?: string;
}

interface EngineConfig {
  provider: string;
  model: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

interface StreamEvent {
  text?: string;
  usage?: { input: number; output: number };
  error?: string;
}

interface BuildRequestParams {
  sys: string;
  msgs: ChatMessage[];
  useTool?: boolean;
  model: string;
  maxTokens?: number;
  temperature?: number;
  tool?: ToolDefinition | null;
  apiKey?: string;
}

interface Provider {
  buildRequest(params: BuildRequestParams): { url: string; init: RequestInit };
  buildStreamRequest(params: BuildRequestParams): { url: string; init: RequestInit };
  parseStreamEvent(rawEvent: string): StreamEvent;
  extract(data: unknown): string;
  logUsage(data: unknown, model: string): void;
}

// ── TTS types ─────────────────────────────────────────────────────────────────

interface TTSHandle {
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  set onended(cb: (() => void) | null);
}

interface TTSAdapterOptions {
  voiceId?: string | null;
  rate?: number;
  key?: string | null;
  model?: string | null;
  region?: string | null;
}

interface TTSAdapter {
  synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle>;
  destroy(): void;
}

interface TTSVoiceEntry {
  id: string;
  label: string;
}

interface TTSModelEntry {
  id: string;
  tier: string;
}

interface TTSProviderMeta {
  id: string;
  name: string;
  requiresKey: boolean;
  reusesLLMKey: string | null;
  voices: TTSVoiceEntry[];
  model?: string;
  models?: TTSModelEntry[];
  keyStorage?: string;
  allowCustomVoiceId?: boolean;
  adapterLoader(): Promise<new (options: TTSAdapterOptions) => TTSAdapter>;
}

// ── Art director / codex types ────────────────────────────────────────────────

interface StyleBible {
  era: string;
  medium: string;
  palette: string[];
  composition: string;
  negatives: string[];
}

interface VisualLedgerEntry {
  id: string;
  tags: string[];
}

type IllustrationStatus = "pending" | "ready" | "failed";

interface Illustration {
  status: IllustrationStatus;
  url?: string;
  prompt?: string;
  caption?: string;
  milestoneReason?: string;
  provider?: string;
}

// ── Image provider types ──────────────────────────────────────────────────────

type ImageProviderId = "pollinations" | "replicate" | "openai" | "local";

interface ImageModelEntry {
  id: string;
  label?: string;
  tier?: string;
}

interface ImageProviderMeta {
  name: string;
  keyless: boolean;
  keyStorage?: string;
  windowKey?: string;
  urlStorage?: string;
  reusesLLMProvider?: string;
  description?: string;
  defaultModel: string;
  models: ImageModelEntry[];
}

interface GeneratedImage {
  url: string;
  provider: string;
}

// ── Settings types ────────────────────────────────────────────────────────────

type CodexMode = "off" | "milestone" | "every";

interface CodexProviderConfig {
  pollinations?: { model: string };
  replicate?: { model: string };
  openai?: { model: string };
  local?: Record<string, never>;
  [key: string]: { model?: string } | undefined;
}

interface CodexSettings {
  mode: CodexMode;
  provider: ImageProviderId;
  providerConfig: CodexProviderConfig;
  artDirectorEngine: EngineConfig;
  maxPerSession: number;
  timeoutMs: number;
}

interface AppSettings {
  highContrast: boolean;
  disableTypewriter: boolean;
  streamNarration: boolean;
  engineStack: string;
  freeModelSelection: boolean;
  engineOpening: EngineConfig;
  engineGM: EngineConfig;
  engineNarrator: EngineConfig;
  codex: CodexSettings;
}

// ── Storage types ─────────────────────────────────────────────────────────────

interface StorageGetResult {
  key: string;
  value: string;
}

interface StorageSetResult {
  key: string;
  value: string;
}

interface StorageDeleteResult {
  key: string;
}

interface StorageListResult {
  keys: string[];
}

interface StorageShim {
  get(key: string): Promise<StorageGetResult | null>;
  set(key: string, value: string): Promise<StorageSetResult>;
  delete(key: string): Promise<StorageDeleteResult>;
  list(prefix?: string): Promise<StorageListResult>;
}

// ── Window augmentation ───────────────────────────────────────────────────────

interface Window {
  storage: StorageShim;
  __sessionPassphrase?: string;
  puter?: any;
}

// ── Size / token estimate types ───────────────────────────────────────────────

interface SizeEstimate {
  bytes: number;
  kb: number;
  tokens: number;
}

// ── Language types ────────────────────────────────────────────────────────────

interface LanguageEntry {
  code: string;
  label: string;
  name: string;
}

// ── Parse result types ───────────────────────────────────────────────────────

interface GMParseResult {
  narration: string;
  state: GameState | null;
  ending: string | null;
  ambience?: AmbienceInput | null;
  raw: string;
  malformed: boolean;
  diagnostic?: string;
}

interface GMLogicParseResult {
  narrator_brief: string;
  state: GameState | null;
  ending: string | null;
  ambience?: AmbienceInput | null;
  raw: string;
  malformed: boolean;
  diagnostic?: string;
}

interface BootstrapParseResult {
  style_bible?: StyleBible;
  visual_ledger?: VisualLedgerEntry[];
  malformed?: boolean;
  diagnostic?: string;
  raw?: string;
}

interface TurnParseResult {
  warrants_illustration?: boolean;
  milestone_reason?: string;
  caption?: string;
  subject_ids?: string[];
  scene_clause?: string;
  extra_negatives?: string[];
  ledger_updates?: VisualLedgerEntry[];
  malformed?: boolean;
  diagnostic?: string;
  raw?: string;
}

// ── Stream factory types ─────────────────────────────────────────────────────

interface ChatCompletionsProviderConfig {
  url: string | (() => string);
  label: string;
  jsonSchema?: boolean;
  tools?: boolean;
  extraBody?: Record<string, unknown>;
}

interface StatePromptBlocks {
  publicBlock: string;
  privateBlock: string;
}

// ── Art director types ───────────────────────────────────────────────────────

interface RealmAestheticSeed {
  era: string;
  medium: string;
  palette: string[];
  mood_words: string[];
  negatives: string[];
}

interface ComposedImagePrompt {
  prompt: string;
  negatives: string[];
}
