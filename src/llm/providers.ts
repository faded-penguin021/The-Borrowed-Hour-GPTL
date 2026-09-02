import type {
  BuildRequestParams,
  ChatMessage,
  ProviderAdapter,
  ProviderId,
  ProviderMeta,
  ProviderRequest,
  StreamEvent,
  ToolDefinition,
} from "../types";
import { BorrowedError } from "./errors";
import { httpStatusHint, extractApiErrorMessage, scrubSecrets } from "./errors";
import { LOCAL_DEFAULT_URL } from "../data/constants";
import { isEncrypted } from "../storage/encryption";
import { decryptStored, KeysUnrecoverableError } from "../passphrase";
import { GM_TOOL } from "./definitions";
import {
  OpenAIResponseDataSchema,
  GeminiResponseDataSchema,
  ClaudeResponseDataSchema
} from "./responseSchemas";

import {
  normalizeContent,
  extractOpenAIText,
  extractGeminiText,
  extractClaudeText,
  sseEventData,
  makeChatCompletionsProvider
} from "./stream";

const normalizeOpenAIMessages = (sys: string, msgs: ChatMessage[]) => [
  { role: "developer", content: sys },
  ...msgs.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: normalizeContent(m.content)
  }))
];
// Gemini deprecated temperature / top_p / top_k starting with 3.5 Flash-Lite
// and 3.6 Flash: today they are silently ignored, and future generations
// return HTTP 400 for supplying them. Omit them from 3.5+ up front rather than
// paying a failed round-trip once the 400 lands. See D-001.
const geminiIgnoresSampling = (model: string): boolean => {
  const m = /^gemini-(\d+)(?:\.(\d+))?/.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0);
  return major > 3 || (major === 3 && minor >= 5);
};

const normalizeGeminiMessages = (msgs: ChatMessage[]) => msgs.map((m) => ({
  role: m.role === "assistant" ? "model" : "user",
  parts: [{ text: normalizeContent(m.content) }]
}));
const normalizeClaudeMessages = (msgs: ChatMessage[]): Array<{ role: string; content: string | Array<Record<string, unknown>> }> => msgs.map((m) => ({
  role: m.role === "assistant" ? "assistant" as const : "user" as const,
  content: normalizeContent(m.content)
}));

// checked: 2026-09-02
export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  gemini: {
    name: "Gemini",
    keyStorage: "borrowed:gemini_api_key:v1",
    windowKey: "GEMINI_API_KEY",
    metaName: "gemini-api-key",
    models: [
      { id: "gemini-3.7-flash", tier: "free" },
      { id: "gemini-3.5-flash-lite", tier: "free" }
    ]
  },
  openai: {
    name: "OpenAI",
    keyStorage: "borrowed:openai_api_key:v1",
    windowKey: "OPENAI_API_KEY",
    metaName: "openai-api-key",
    models: [
      { id: "gpt-5.6-sol", tier: "paid" },
      { id: "gpt-5.6-terra", tier: "paid" },
      { id: "gpt-5.6-luna", tier: "paid" }
    ]
  },
  anthropic: {
    name: "Claude",
    keyStorage: "borrowed:anthropic_api_key:v1",
    windowKey: "ANTHROPIC_API_KEY",
    metaName: "anthropic-api-key",
    models: [
      { id: "claude-fable-5-1", tier: "paid" },
      { id: "claude-opus-5", tier: "paid" },
      { id: "claude-sonnet-5", tier: "paid" },
      { id: "claude-haiku-4-5-20251001", tier: "paid" }
    ]
  },
  deepseek: {
    name: "DeepSeek",
    keyStorage: "borrowed:deepseek_api_key:v1",
    windowKey: "DEEPSEEK_API_KEY",
    metaName: "deepseek-api-key",
    models: [
      { id: "deepseek-v4-flash", tier: "paid" },
      { id: "deepseek-v4-pro", tier: "paid" }
    ]
  },
  qwen: {
    name: "Qwen",
    keyStorage: "borrowed:qwen_api_key:v1",
    windowKey: "QWEN_API_KEY",
    metaName: "qwen-api-key",
    models: [
      { id: "qwen3.7-plus", tier: "paid" },
      { id: "qwen3.7-flash", tier: "paid" },
      { id: "qwen-plus", tier: "paid" },
      { id: "qwen-flash", tier: "paid" }
    ]
  },
  kimi: {
    name: "Kimi",
    keyStorage: "borrowed:kimi_api_key:v1",
    windowKey: "KIMI_API_KEY",
    metaName: "kimi-api-key",
    models: [
      { id: "kimi-k3", tier: "paid" },
      { id: "kimi-k2.7-code", tier: "paid" },
      { id: "kimi-k2.6", tier: "paid" }
    ]
  },
  ernie: {
    name: "ERNIE",
    keyStorage: "borrowed:ernie_api_key:v1",
    windowKey: "ERNIE_API_KEY",
    metaName: "ernie-api-key",
    models: [
      { id: "ernie-5.1", tier: "paid" },
      { id: "ernie-4.5-turbo-128k", tier: "paid" },
      { id: "ernie-4.5-turbo-32k", tier: "paid" }
    ]
  },
  mistral: {
    name: "Mistral",
    keyStorage: "borrowed:mistral_api_key:v1",
    windowKey: "MISTRAL_API_KEY",
    metaName: "mistral-api-key",
    models: [
      { id: "mistral-small-latest", tier: "free" },
      { id: "mistral-medium-latest", tier: "free" },
      { id: "mistral-large-latest", tier: "free" }
    ]
  },
  groq: {
    name: "Groq",
    keyStorage: "borrowed:groq_api_key:v1",
    windowKey: "GROQ_API_KEY",
    metaName: "groq-api-key",
    models: [
      { id: "openai/gpt-oss-120b", tier: "free" },
      { id: "openai/gpt-oss-20b", tier: "free" },
      { id: "qwen/qwen3.6-27b", tier: "free" },
      { id: "groq/compound", tier: "free" }
    ]
  },
  openrouter: {
    name: "OpenRouter",
    keyStorage: "borrowed:openrouter_api_key:v1",
    windowKey: "OPENROUTER_API_KEY",
    metaName: "openrouter-api-key",
    models: [
      { id: "nvidia/nemotron-3-ultra-550b-a55b:free", tier: "free" },
      { id: "google/gemma-4-31b-it:free", tier: "free" },
      { id: "anthropic/claude-fable-5.1", tier: "paid" },
      { id: "openai/gpt-5.6-luna", tier: "paid" },
      { id: "openai/gpt-oss-20b", tier: "paid" },
      { id: "moonshotai/kimi-k2.7-code", tier: "paid" }
    ]
  },
  cerebras: {
    // Cerebras' free tier caps context at 8192 tokens — too small for this app's GM turns. Needs a paid tier.
    name: "Cerebras",
    keyStorage: "borrowed:cerebras_api_key:v1",
    windowKey: "CEREBRAS_API_KEY",
    metaName: "cerebras-api-key",
    models: [
      { id: "gpt-oss-120b", tier: "paid" },
      { id: "gemma-4-31b", tier: "paid" }
    ]
  },
  local: {
    name: "Local LLM",
    keyStorage: "borrowed:local_api_key:v1",
    urlStorage: "borrowed:local_url:v1",
    windowKey: "LOCAL_LLM_API_KEY",
    metaName: "local-llm-api-key",
    keyOptional: true,
    models: [
      { id: "llama3.2", tier: "free" },
      { id: "llama3.1", tier: "free" },
      { id: "mistral", tier: "free" },
      { id: "phi3", tier: "free" },
      { id: "qwen2.5", tier: "free" }
    ]
  }
};
export const PROVIDER_ORDER: ProviderId[] = ["gemini", "openai", "anthropic", "deepseek", "qwen", "kimi", "ernie", "mistral", "groq", "openrouter", "cerebras", "local"];
export const FREE_MODELS_BY_PROVIDER = {
  free:       { provider: "mistral",    opener: "mistral-large-latest",                gm: "mistral-medium-latest",             narrator: "mistral-medium-latest" },
  gemini:     { opener: "gemini-3.7-flash",         gm: "gemini-3.7-flash",            narrator: "gemini-3.7-flash" },
  openai:     { opener: "gpt-5.6-terra",            gm: "gpt-5.6-terra",              narrator: "gpt-5.6-luna" },
  anthropic:  { opener: "claude-sonnet-5",          gm: "claude-haiku-4-5-20251001",  narrator: "claude-haiku-4-5-20251001" },
  deepseek:   { opener: "deepseek-v4-flash",        gm: "deepseek-v4-flash",          narrator: "deepseek-v4-flash" },
  qwen:       { opener: "qwen3.7-plus",             gm: "qwen3.7-flash",              narrator: "qwen3.7-flash" },
  kimi:       { opener: "kimi-k3",                   gm: "kimi-k2.6",                  narrator: "kimi-k2.6" },
  ernie:      { opener: "ernie-5.1",                gm: "ernie-4.5-turbo-32k",        narrator: "ernie-4.5-turbo-32k" },
  mistral:    { opener: "mistral-large-latest",     gm: "mistral-medium-latest",      narrator: "mistral-medium-latest" },
  groq:       { opener: "openai/gpt-oss-120b",      gm: "openai/gpt-oss-120b",        narrator: "openai/gpt-oss-20b" },
  openrouter: { opener: "nvidia/nemotron-3-ultra-550b-a55b:free", gm: "nvidia/nemotron-3-ultra-550b-a55b:free", narrator: "google/gemma-4-31b-it:free" },
  cerebras:   { opener: "gpt-oss-120b",             gm: "gpt-oss-120b",               narrator: "gpt-oss-120b" },
  local:      { opener: "llama3.2",                 gm: "llama3.1",                   narrator: "llama3.2" }
};
export const getLocalUrl = (): string => localStorage.getItem(PROVIDER_META.local.urlStorage as string)?.trim() || LOCAL_DEFAULT_URL;
export const getProviderKey = async (id: ProviderId, opts?: { allowMissing?: boolean }): Promise<string> => {
  const m = PROVIDER_META[id];
  if (!m)
    throw new BorrowedError("The hour cannot open yet.", `Unknown API provider "${id}".`);
  const injected = (window as unknown as Record<string, string>)[m.windowKey] || (document.querySelector(`meta[name="${m.metaName}"]`) as HTMLMetaElement | null)?.content;
  if (injected)
    return injected.trim();
  const stored = localStorage.getItem(m.keyStorage);
  if (stored) {
    if (!isEncrypted(stored))
      return stored.trim();
    let plain: string | null;
    try {
      plain = await decryptStored(m.keyStorage, stored);
    } catch (e) {
      if (e instanceof KeysUnrecoverableError)
        throw new BorrowedError("The hour cannot open yet.", "Your stored keys can't be unlocked — the saved encryption salt is missing. Open Settings → System to clear and re-enter them.");
      // Wrong passphrase (decryptStored has already cleared the cached key).
      throw new BorrowedError("The hour cannot open yet.", "Could not unlock the API key — wrong passphrase. Try again.");
    }
    if (plain == null)
      throw new BorrowedError("The hour cannot open yet.", "A session passphrase is required to unlock your API key.");
    return plain;
  }
  if (m.keyOptional)
    return "";
  // BYOB proxy calls tolerate an absent key — the proxy attaches credentials
  // server-side. A stored key that fails to unlock still throws above.
  if (opts?.allowMissing)
    return "";
  throw new BorrowedError("The hour cannot open yet.", `No ${m.name} API key is saved. Open Settings → API keys and paste your key there.`);
};
export const resetProviderKey = (id: ProviderId) => {
  const m = PROVIDER_META[id];
  if (m)
    localStorage.removeItem(m.keyStorage);
};

/**
 * BYOB proxy rewrite shared by the live client and the health check: route the
 * request through `<proxy>?target=<encoded provider URL>` and strip the
 * browser-held key headers — the proxy attaches its own credentials
 * server-side. Mutates and returns the same request object; the body is left
 * untouched so stream requests are forwarded verbatim.
 */
export const applyProxyToRequest = <T extends { url: string; headers: Record<string, string> }>(request: T, proxyUrl?: string | null): T => {
  const trimmed = proxyUrl?.trim();
  if (!trimmed) return request;
  // A user-entered proxy URL may already carry query params; append accordingly.
  const sep = trimmed.includes("?") ? "&" : "?";
  request.url = `${trimmed}${sep}target=${encodeURIComponent(request.url)}`;
  if (request.headers) {
    delete request.headers["Authorization"];
    delete request.headers["x-api-key"];
    delete request.headers["x-goog-api-key"];
  }
  return request;
};

/**
 * Lightweight connectivity check: resolves key, then fires a tiny
 * request to the provider's endpoint. Returns { ok, detail }.
 * With a proxy URL the ping travels the same BYOB route as real calls.
 */
export const checkProviderHealth = async (id: ProviderId, model?: string, proxyUrl?: string): Promise<{ ok: boolean; detail: string }> => {
  const m = PROVIDER_META[id];
  if (!m) return { ok: false, detail: `Unknown provider "${id}".` };
  const proxied = !!proxyUrl?.trim();
  let apiKey: string;
  try {
    apiKey = await getProviderKey(id, { allowMissing: proxied });
  } catch (e) {
    return { ok: false, detail: e instanceof BorrowedError ? (e.detail || e.message) : String(e) };
  }
  if (!apiKey && !m.keyOptional && !proxied) return { ok: false, detail: `No API key configured for ${m.name}.` };
  const provider = PROVIDERS[id];
  if (!provider) return { ok: false, detail: `No adapter registered for ${m.name}.` };
  const testModel = model || m.models[0]?.id || "";
  try {
    // maxTokens 16 is the OpenAI Responses floor for max_output_tokens;
    // temperature is omitted because current Anthropic/OpenAI flagships reject
    // the parameter with a 400 — either would fail the ping with a valid key.
    const request = provider.buildRequest({
      sys: "Reply with exactly: ok",
      msgs: [{ role: "user", content: "Ping." }],
      useTool: false, model: testModel, maxTokens: 16, tool: null, apiKey
    });
    applyProxyToRequest(request, proxyUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) return { ok: true, detail: `${m.name} (${testModel}) responded.` };
    let snip = ""; try { snip = scrubSecrets((await res.text()).slice(0, 300)); } catch {}
    const hint = httpStatusHint(res.status, m.name);
    const apiMsg = extractApiErrorMessage(snip);
    return { ok: false, detail: apiMsg ? `${hint} ${apiMsg}` : hint };
  } catch (e) {
    const caught = e as { name?: string; message?: string };
    if (caught?.name === "AbortError") return { ok: false, detail: `${m.name} did not respond within 10 seconds.` };
    const msg = caught?.message || String(e);
    const isCORS = /failed to fetch|networkerror|cors|load failed/i.test(msg);
    if (isCORS && id === "local") {
      return { ok: false, detail: `Could not reach the local LLM endpoint. If using Ollama, set OLLAMA_ORIGINS to your app's origin (e.g. http://localhost:5173). For LM Studio, enable CORS in the server settings.` };
    }
    return { ok: false, detail: `Network error reaching ${m.name}: ${msg}` };
  }
};

export const PROVIDERS: Record<string, ProviderAdapter> = {
  openai: {
    toolUse: true,
    retryable: new Set([408, 409, 429, 500, 502, 503, 504]),
    buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }: BuildRequestParams): ProviderRequest {
      const body: Record<string, unknown> = {
        model,
        input: normalizeOpenAIMessages(sys, msgs),
        max_output_tokens: maxTokens
      };
      if (temperature !== undefined)
        body.temperature = temperature;
      if (useTool) {
        const t = tool as ToolDefinition;
        body.text = {
          format: {
            type: "json_schema",
            name: t.name,
            schema: t.input_schema,
            strict: false
          }
        };
      }
      return {
        url: "https://api.openai.com/v1/responses",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body
      };
    },
    logUsage(data: unknown, model: string): void {
      const parsed = OpenAIResponseDataSchema.safeParse(data);
      if (!parsed.success || !parsed.data.usage)
        return;
      const u = parsed.data.usage;
      console.debug("[borrowed] usage", {
        model,
        input: u.input_tokens || 0,
        cached_input: u.input_tokens_details?.cached_tokens || 0,
        output: u.output_tokens || 0,
        total: u.total_tokens || 0
      });
    },
    buildStreamRequest(params: BuildRequestParams): ProviderRequest {
      const request = this.buildRequest({ ...params, useTool: false, tool: GM_TOOL });
      request.body.stream = true;
      return request;
    },
    parseStreamEvent(rawEvent: string): StreamEvent | null {
      const data = sseEventData(rawEvent);
      if (!data || data === "[DONE]")
        return null;
      let json: {
        type?: string;
        delta?: unknown;
        response?: { usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
        message?: string;
      };
      try {
        json = JSON.parse(data);
      } catch {
        return null;
      }
      const out: StreamEvent = {};
      if (json.type === "response.output_text.delta" && typeof json.delta === "string")
        out.text = json.delta;
      if ((json.type === "response.completed" || json.type === "response.incomplete") && json.response?.usage)
        out.usage = {
          input: json.response.usage.input_tokens || 0,
          output: json.response.usage.output_tokens || 0
        };
      if (json.type === "error" || json.type === "response.failed")
        out.error = json.response?.error?.message || json.message || "stream error";
      return out;
    },
    extract(data: unknown): string {
      const text = extractOpenAIText(data);
      if (!text) {
        const d = OpenAIResponseDataSchema.safeParse(data).data ?? {};
        const status = d.status || "unknown";
        const incomplete = d.incomplete_details?.reason ? ` Reason: ${d.incomplete_details.reason}.` : "";
        throw new BorrowedError("The page came back blank.", `OpenAI returned an empty response. Status: ${status}.${incomplete}`);
      }
      return text;
    }
  },
  gemini: {
    toolUse: true,
    retryable: new Set([408, 409, 429, 500, 502, 503, 504]),
    buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }: BuildRequestParams): ProviderRequest {
      const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens };
      if (temperature !== undefined && !geminiIgnoresSampling(model))
        generationConfig.temperature = temperature;
      if (useTool) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseJsonSchema = (tool as ToolDefinition).input_schema;
      }
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey as string },
        body: {
          systemInstruction: { parts: [{ text: sys }] },
          contents: normalizeGeminiMessages(msgs),
          generationConfig
        }
      };
    },
    logUsage(data: unknown, model: string): void {
      const parsed = GeminiResponseDataSchema.safeParse(data);
      if (!parsed.success || !parsed.data.usageMetadata)
        return;
      const u = parsed.data.usageMetadata;
      console.debug("[borrowed] usage", {
        model,
        input: u.promptTokenCount || 0,
        cached_input: u.cachedContentTokenCount || 0,
        output: u.candidatesTokenCount || 0,
        total: u.totalTokenCount || 0
      });
    },
    buildStreamRequest({ sys, msgs, model, maxTokens, temperature, apiKey }: BuildRequestParams): ProviderRequest {
      const request = this.buildRequest({ sys, msgs, useTool: false, model, maxTokens, temperature, tool: GM_TOOL, apiKey });
      request.url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      return request;
    },
    parseStreamEvent(rawEvent: string): StreamEvent | null {
      const data = sseEventData(rawEvent);
      if (!data)
        return null;
      let json: {
        candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        error?: { message?: string };
      };
      try {
        json = JSON.parse(data);
      } catch {
        return null;
      }
      const out: StreamEvent = {};
      let text = "";
      for (const candidate of json.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (typeof part.text === "string")
            text += part.text;
        }
      }
      if (text)
        out.text = text;
      if (json.usageMetadata)
        out.usage = {
          input: json.usageMetadata.promptTokenCount || 0,
          output: json.usageMetadata.candidatesTokenCount || 0
        };
      if (json.error)
        out.error = json.error.message || String(json.error);
      return out;
    },
    extract(data: unknown): string {
      const text = extractGeminiText(data);
      if (!text) {
        const d = GeminiResponseDataSchema.safeParse(data).data ?? {};
        const reason = d.promptFeedback?.blockReason || d.candidates?.[0]?.finishReason || "unknown";
        throw new BorrowedError("The page came back blank.", `Gemini returned an empty response. Reason: ${reason}.`);
      }
      return text;
    }
  },
  anthropic: {
    toolUse: true,
    retryable: new Set([408, 409, 429, 500, 502, 503, 504, 529]),
    buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey, cacheBreakpoint }: BuildRequestParams): ProviderRequest {
      const normalized = normalizeClaudeMessages(msgs);
      if (cacheBreakpoint && cacheBreakpoint > 0 && cacheBreakpoint <= normalized.length) {
        const target = normalized[cacheBreakpoint - 1];
        const text = typeof target.content === "string" ? target.content : "";
        target.content = [{ type: "text", text, cache_control: { type: "ephemeral" } }];
      }
      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        system: [{ type: "text", text: sys, cache_control: { type: "ephemeral", ttl: "1h" } }],
        messages: normalized
      };
      if (temperature !== undefined)
        body.temperature = temperature;
      if (useTool) {
        const t = tool as ToolDefinition;
        body.tools = [t];
        body.tool_choice = { type: "tool", name: t.name };
      }
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey as string,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "extended-cache-ttl-2025-04-11",
          // CORS opt-in: without it Anthropic never sets
          // Access-Control-Allow-Origin and every direct browser call dies in
          // preflight. "dangerous" is their name for the BYOK pattern this app
          // is — the key holder is the user, in their own browser.
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body
      };
    },
    logUsage(data: unknown, model: string): void {
      const parsed = ClaudeResponseDataSchema.safeParse(data);
      if (!parsed.success || !parsed.data.usage)
        return;
      const u = parsed.data.usage;
      console.debug("[borrowed] usage", {
        model,
        input: u.input_tokens || 0,
        cache_read: u.cache_read_input_tokens || 0,
        cache_write: u.cache_creation_input_tokens || 0,
        output: u.output_tokens || 0
      });
    },
    buildStreamRequest(params: BuildRequestParams): ProviderRequest {
      const request = this.buildRequest({ ...params, useTool: false, tool: GM_TOOL });
      request.body.stream = true;
      return request;
    },
    parseStreamEvent(rawEvent: string): StreamEvent | null {
      const data = sseEventData(rawEvent);
      if (!data)
        return null;
      let json: {
        type?: string;
        delta?: { type?: string; text?: unknown };
        message?: { usage?: { input_tokens?: number; output_tokens?: number } };
        usage?: { output_tokens?: number };
        error?: { message?: string };
      };
      try {
        json = JSON.parse(data);
      } catch {
        return null;
      }
      const out: StreamEvent = {};
      if (json.type === "content_block_delta" && json.delta?.type === "text_delta" && typeof json.delta.text === "string")
        out.text = json.delta.text;
      if (json.type === "message_start" && json.message?.usage)
        out.usage = {
          input: json.message.usage.input_tokens || 0,
          output: json.message.usage.output_tokens || 0
        };
      if (json.type === "message_delta" && json.usage)
        // Anthropic's message_delta reports only output tokens; input was
        // already emitted by message_start and is preserved by the consumer's
        // Object.assign merge. Cast keeps that runtime shape (no `input` key).
        out.usage = ({ output: json.usage.output_tokens || 0 } as StreamEvent["usage"]);
      if (json.type === "error")
        out.error = json.error?.message || "stream error";
      return out;
    },
    extract(data: unknown, useTool?: boolean, tool?: ToolDefinition | null, maxTokens?: number): string {
      const d = ClaudeResponseDataSchema.safeParse(data).data ?? {};
      if (useTool) {
        const t = tool as ToolDefinition;
        const toolUse = (d.content || []).find((part) => part.type === "tool_use" && part.name === t.name);
        if (toolUse) {
          if (d.stop_reason === "max_tokens") {
            throw new BorrowedError("The hour falters.", `Tool input was truncated mid-JSON by max_tokens (currently ${maxTokens}). Increase max_tokens or shorten the prompt.`);
          }
          if (toolUse.input && typeof toolUse.input === "object")
            return JSON.stringify(toolUse.input);
          if (typeof toolUse.input === "string" && toolUse.input.trim())
            return toolUse.input;
        }
      }
      const text = extractClaudeText(data);
      if (!text) {
        const stop = d.stop_reason || "unknown";
        throw new BorrowedError("The page came back blank.", `Claude returned an empty response. Stop reason: ${stop}.`);
      }
      return text;
    }
  },
  deepseek: makeChatCompletionsProvider({
    url: "https://api.deepseek.com/chat/completions",
    label: "DeepSeek",
    tools: true,
    // DeepSeek V4 enables thinking by default, which rejects forced
    // tool_choice. Disable thinking so we can pin the model to the schema.
    extraBody: { thinking: { type: "disabled" } }
  }),
  qwen: makeChatCompletionsProvider({
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    label: "Qwen",
    tools: true
  }),
  kimi: makeChatCompletionsProvider({
    url: "https://api.moonshot.cn/v1/chat/completions",
    label: "Kimi",
    tools: true
  }),
  ernie: makeChatCompletionsProvider({
    url: "https://qianfan.baidubce.com/v2/chat/completions",
    label: "ERNIE",
    jsonSchema: false
  }),
  mistral: makeChatCompletionsProvider({
    url: "https://api.mistral.ai/v1/chat/completions",
    label: "Mistral",
    tools: true,
    promptCacheKey: true
  }),
  groq: makeChatCompletionsProvider({
    url: "https://api.groq.com/openai/v1/chat/completions",
    label: "Groq",
    tools: true
  }),
  openrouter: makeChatCompletionsProvider({
    url: "https://openrouter.ai/api/v1/chat/completions",
    label: "OpenRouter",
    tools: true
  }),
  cerebras: makeChatCompletionsProvider({
    url: "https://api.cerebras.ai/v1/chat/completions",
    label: "Cerebras",
    tools: true
  }),
  local: makeChatCompletionsProvider({
    url: () => getLocalUrl(),
    label: "Local LLM",
    jsonSchema: false
  })
};
export const providerSupportsToolUse = (id: ProviderId): boolean => !!PROVIDERS[id]?.toolUse;
export const TOOL_USE_PROVIDER_ORDER = PROVIDER_ORDER.filter(providerSupportsToolUse);
