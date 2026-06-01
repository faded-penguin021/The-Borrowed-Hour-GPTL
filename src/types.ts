// Domain type definitions for The Borrowed Hour.
//
// These are explicit ES-module exports: import the types you need
// (`import type { GameState } from "../types"` in TS, or a JSDoc
// `@import { GameState } from "../types"` block in JS). The lone remaining
// ambient declaration — the `Window` augmentation — lives in `src/global.d.ts`,
// because global augmentation genuinely belongs in an ambient `.d.ts`.

// ── Ambience ─────────────────────────────────────────────────────────────────

export type AmbienceSpace =
  | "intimate" | "chamber" | "hall" | "cavern"
  | "street" | "field" | "forest" | "vehicle" | "void";

export type AmbiencePopulation =
  | "solitary" | "sparse_voices" | "crowd" | "machinery"
  | "nature" | "ceremony" | "creature" | "wild";

export type AmbienceMood =
  | "calm" | "tender" | "tense" | "ominous"
  | "joyous" | "melancholy" | "urgent" | "mysterious";

export type AmbiencePalette =
  | "strings" | "piano" | "synth" | "glass"
  | "choir" | "reed" | "brass" | "guitar";

export type AmbienceEvent =
  | "bell_toll" | "bell_distant" | "clock_chime"
  | "door_close" | "door_creak"
  | "footsteps_close" | "footsteps_recede"
  | "wind_gust" | "distant_thunder"
  | "paper_rustle" | "chair_scrape" | "glass_set_down" | "coin_drop"
  | "crowd_hush" | "cough_distant" | "breath_held"
  | "metal_clang" | "whisper_close";

export interface AmbienceInput {
  space?: AmbienceSpace;
  population?: AmbiencePopulation;
  mood?: AmbienceMood;
  palette?: AmbiencePalette;
  events?: AmbienceEvent[];
}

// ── Error handling ────────────────────────────────────────────────────────────

// Loose shape for values caught in a `catch` clause. Under `useUnknownInCatchVariables`
// a caught value is `unknown`; thrown values may be a BorrowedError, a native
// Error/DOMException, or an arbitrary object. The app reads these fields
// defensively (always guarded or optional-chained), so model them all as optional.
export interface ThrownError {
  name?: string;
  message?: string;
  detail?: string;
  partial?: string;
  raw?: string;
  status?: number;
  code?: number;
}

// ── Core game types ───────────────────────────────────────────────────────────

export interface NPC {
  name: string;
  note: string;
}

export interface GameState {
  scene: string;
  time: string;
  inventory: string[];
  npcs: NPC[];
  clues: string[];
  summary: string;
  hidden_state: string;
}

export type EndingType = "good" | "bittersweet" | "pyrrhic" | "ambiguous" | "bad";

// Per-premise discovered-endings map: premiseId -> { endingType: true }.
export type EndingsByPremise = Record<string, Record<string, boolean>>;

export interface NarrationEntry {
  type: "narration";
  text: string;
  fullyRevealed: boolean;
  streaming?: boolean;
  illustration?: Illustration;
}

export interface ActionEntry {
  type: "action";
  text: string;
  fullyRevealed: boolean;
  role?: "user" | "assistant";
  streaming?: boolean;
  illustration?: Illustration;
}

export type Entry = NarrationEntry | ActionEntry;

export interface Premise {
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

export interface ModelEntry {
  id: string;
  label?: string;
  tier?: string;
  isFree?: boolean;
}

export type ProviderId =
  | "gemini" | "openai" | "anthropic" | "deepseek"
  | "qwen" | "kimi" | "ernie" | "mistral"
  | "groq" | "openrouter" | "cerebras" | "local";

export interface ProviderMeta {
  name: string;
  keyStorage: string;
  windowKey: string;
  metaName: string;
  models: ModelEntry[];
  keyOptional?: boolean;
  urlStorage?: string;
}

export interface EngineConfig {
  provider: string;
  model: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface StreamEvent {
  text?: string;
  usage?: { input: number; output: number };
  error?: string;
}

export interface BuildRequestParams {
  sys: string;
  msgs: ChatMessage[];
  useTool?: boolean;
  model: string;
  maxTokens?: number;
  temperature?: number;
  tool?: ToolDefinition | null;
  apiKey?: string;
}

export interface Provider {
  buildRequest(params: BuildRequestParams): { url: string; init: RequestInit };
  buildStreamRequest(params: BuildRequestParams): { url: string; init: RequestInit };
  parseStreamEvent(rawEvent: string): StreamEvent;
  extract(data: unknown): string;
  logUsage(data: unknown, model: string): void;
}

// ── TTS types ─────────────────────────────────────────────────────────────────

export interface TTSHandle {
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  set onended(cb: (() => void) | null);
}

export interface TTSAdapterOptions {
  voiceId?: string | null;
  rate?: number;
  key?: string | null;
  model?: string | null;
  region?: string | null;
}

export interface TTSAdapter {
  synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle>;
  destroy(): void;
}

export interface TTSVoiceEntry {
  id: string;
  label: string;
}

export interface TTSModelEntry {
  id: string;
  tier: string;
}

export interface TTSProviderMeta {
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

export interface StyleBible {
  era: string;
  medium: string;
  palette: string[];
  composition: string;
  negatives: string[];
}

export interface VisualLedgerEntry {
  id: string;
  tags: string[];
}

export type IllustrationStatus = "pending" | "ready" | "failed";

export interface Illustration {
  status: IllustrationStatus;
  url?: string;
  prompt?: string;
  caption?: string;
  milestoneReason?: string;
  provider?: string;
}

// ── Image provider types ──────────────────────────────────────────────────────

export type ImageProviderId = "pollinations" | "replicate" | "openai" | "local";

export interface ImageModelEntry {
  id: string;
  label?: string;
  tier?: string;
}

export interface ImageProviderMeta {
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

export interface GeneratedImage {
  url: string;
  provider: string;
}

// ── Settings types ────────────────────────────────────────────────────────────

// Illustration-frequency mode. These literals are the persisted values written
// by the settings UI and read by the codex runtime (src/hooks/useCodex.js):
// "off" disables plates, "always" requests one every turn, and "key_moments"
// (the default non-off mode) lets the Art Director gate plates to milestones.
export type CodexMode = "off" | "key_moments" | "always";

export interface CodexProviderConfig {
  pollinations?: { model: string };
  replicate?: { model: string };
  openai?: { model: string };
  local?: Record<string, never>;
  [key: string]: { model?: string } | undefined;
}

export interface CodexSettings {
  mode: CodexMode;
  provider: ImageProviderId;
  providerConfig: CodexProviderConfig;
  artDirectorEngine: EngineConfig;
  maxPerSession: number;
  timeoutMs: number;
}

export interface AppSettings {
  highContrast: boolean;
  disableTypewriter: boolean;
  streamNarration: boolean;
  engineStack: string;
  freeModelSelection: boolean;
  engineOpening: EngineConfig;
  engineGM: EngineConfig;
  engineNarrator: EngineConfig;
  codex: CodexSettings;
  /** BYOB proxy endpoint. When set, API calls route through it and browser-held key headers are stripped. */
  proxyUrl: string;
}

// ── Storage types ─────────────────────────────────────────────────────────────

export interface StorageGetResult {
  key: string;
  value: string;
}

export interface StorageSetResult {
  key: string;
  value: string;
}

export interface StorageDeleteResult {
  key: string;
}

export interface StorageListResult {
  keys: string[];
}

export interface StorageShim {
  get(key: string): Promise<StorageGetResult | null>;
  set(key: string, value: string): Promise<StorageSetResult>;
  delete(key: string): Promise<StorageDeleteResult>;
  list(prefix?: string): Promise<StorageListResult>;
}

// ── Size / token estimate types ───────────────────────────────────────────────

export interface SizeEstimate {
  bytes: number;
  kb: number;
  tokens: number;
}

// ── Language types ────────────────────────────────────────────────────────────

export interface LanguageEntry {
  code: string;
  label: string;
  name: string;
}

// ── Parse result types ───────────────────────────────────────────────────────

export interface GMParseResult {
  narration: string;
  state: GameState | null;
  ending: string | null;
  ambience?: AmbienceInput | null;
  raw: string;
  malformed: boolean;
  diagnostic?: string;
}

export interface GMLogicParseResult {
  narrator_brief: string;
  state: GameState | null;
  ending: string | null;
  ambience?: AmbienceInput | null;
  raw: string;
  malformed: boolean;
  diagnostic?: string;
}

export interface BootstrapParseResult {
  style_bible?: StyleBible;
  visual_ledger?: VisualLedgerEntry[];
  malformed?: boolean;
  diagnostic?: string;
  raw?: string;
}

export interface TurnParseResult {
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

export interface ChatCompletionsProviderConfig {
  url: string | (() => string);
  label: string;
  jsonSchema?: boolean;
  tools?: boolean;
  extraBody?: Record<string, unknown>;
}

export interface StatePromptBlocks {
  publicBlock: string;
  privateBlock: string;
}

// ── Art director types ───────────────────────────────────────────────────────

export interface RealmAestheticSeed {
  era: string;
  medium: string;
  palette: string[];
  mood_words: string[];
  negatives: string[];
}

export interface ComposedImagePrompt {
  prompt: string;
  negatives: string[];
}
