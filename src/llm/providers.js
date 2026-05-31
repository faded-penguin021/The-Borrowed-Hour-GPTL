// @ts-check
import { BorrowedError } from "./errors.js";
import { httpStatusHint, extractApiErrorMessage, scrubSecrets } from "./errors.js";
import { LOCAL_DEFAULT_URL } from "../data/constants.js";
import { ENC_PREFIX, decryptSecret } from "../storage/encryption.js";

// GM_TOOL circular-dependency break: tools.js imports from providers.js, and
// providers.js needs GM_TOOL (defined in tools.js) only inside buildStreamRequest
// methods — which are called at runtime, not at module load time. We expose a
// setGMTool() setter here; tools.js calls setGMTool(GM_TOOL) after it defines it.
// That way neither module needs a top-level import of the other.
/** @type {ToolDefinition | null} */
let _gmTool = null;
/** @param {ToolDefinition} tool */
export function setGMTool(tool) { _gmTool = tool; }
function _getGMTool() { return _gmTool; }

import {
  normalizeContent,
  normalizeChatMessages,
  extractChatText,
  extractChatToolCallArgs,
  extractOpenAIText,
  extractGeminiText,
  extractClaudeText,
  sseEventData,
  parseChatStreamEvent,
  makeChatCompletionsProvider
} from "./stream.js";

/** @type {(opts: any) => any} */
var _mkCCP = makeChatCompletionsProvider;

var normalizeOpenAIMessages = (sys, msgs) => [
  { role: "developer", content: sys },
  ...msgs.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: normalizeContent(m.content)
  }))
];
var normalizeGeminiMessages = (msgs) => msgs.map((m) => ({
  role: m.role === "assistant" ? "model" : "user",
  parts: [{ text: normalizeContent(m.content) }]
}));
var normalizeClaudeMessages = (msgs) => msgs.map((m) => ({
  role: m.role === "assistant" ? "assistant" : "user",
  content: normalizeContent(m.content)
}));

// checked: 2026-05-28
/** @type {Record<ProviderId, ProviderMeta>} */
export var PROVIDER_META = {
  gemini: {
    name: "Gemini",
    keyStorage: "borrowed:gemini_api_key:v1",
    windowKey: "GEMINI_API_KEY",
    metaName: "gemini-api-key",
    models: [
      { id: "gemini-3.5-flash", tier: "free" },
      { id: "gemini-3.1-flash-lite", tier: "free" },
      { id: "gemini-3-flash", tier: "free" }
    ]
  },
  openai: {
    name: "OpenAI",
    keyStorage: "borrowed:openai_api_key:v1",
    windowKey: "OPENAI_API_KEY",
    metaName: "openai-api-key",
    models: [
      { id: "gpt-5.5", tier: "paid" },
      { id: "gpt-5.4-mini", tier: "paid" },
      { id: "gpt-5-mini", tier: "paid" },
      { id: "gpt-5.4-nano", tier: "paid" }
    ]
  },
  anthropic: {
    name: "Claude",
    keyStorage: "borrowed:anthropic_api_key:v1",
    windowKey: "ANTHROPIC_API_KEY",
    metaName: "anthropic-api-key",
    models: [
      { id: "claude-opus-4-7", tier: "paid" },
      { id: "claude-sonnet-4-6", tier: "paid" },
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
      { id: "qwen-plus", tier: "paid" },
      { id: "qwen-flash", tier: "paid" },
      { id: "qwen-max", tier: "paid" },
      { id: "qwen-turbo", tier: "paid" }
    ]
  },
  kimi: {
    name: "Kimi",
    keyStorage: "borrowed:kimi_api_key:v1",
    windowKey: "KIMI_API_KEY",
    metaName: "kimi-api-key",
    models: [
      { id: "kimi-k2.6", tier: "paid" },
      { id: "kimi-k2.5", tier: "paid" }
    ]
  },
  ernie: {
    name: "ERNIE",
    keyStorage: "borrowed:ernie_api_key:v1",
    windowKey: "ERNIE_API_KEY",
    metaName: "ernie-api-key",
    models: [
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
      { id: "llama-3.3-70b-versatile", tier: "free" },
      { id: "qwen-3-32b", tier: "free" }
    ]
  },
  openrouter: {
    name: "OpenRouter",
    keyStorage: "borrowed:openrouter_api_key:v1",
    windowKey: "OPENROUTER_API_KEY",
    metaName: "openrouter-api-key",
    models: [
      { id: "deepseek/deepseek-v4-flash:free", tier: "free" },
      { id: "meta-llama/llama-4-maverick:free", tier: "free" },
      { id: "meta-llama/llama-4-scout:free", tier: "free" },
      { id: "anthropic/claude-sonnet-4-6", tier: "paid" },
      { id: "openai/gpt-5.4-mini", tier: "paid" }
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
      { id: "llama-3.3-70b", tier: "paid" },
      { id: "qwen-3-32b", tier: "paid" }
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
export var PROVIDER_ORDER = ["gemini", "openai", "anthropic", "deepseek", "qwen", "kimi", "ernie", "mistral", "groq", "openrouter", "cerebras", "local"];
export var FREE_MODELS_BY_PROVIDER = {
  free:       { provider: "mistral",    opener: "mistral-large-latest",                gm: "mistral-medium-latest",             narrator: "mistral-medium-latest" },
  gemini:     { opener: "gemini-3.5-flash",         gm: "gemini-3.5-flash",            narrator: "gemini-3.5-flash" },
  openai:     { opener: "gpt-5-mini",               gm: "gpt-5.4-mini",               narrator: "gpt-5.4-nano" },
  anthropic:  { opener: "claude-sonnet-4-6",        gm: "claude-haiku-4-5-20251001",  narrator: "claude-haiku-4-5-20251001" },
  deepseek:   { opener: "deepseek-v4-flash",        gm: "deepseek-v4-flash",          narrator: "deepseek-v4-flash" },
  qwen:       { opener: "qwen-plus",                gm: "qwen-plus",                  narrator: "qwen-flash" },
  kimi:       { opener: "kimi-k2.5",                gm: "kimi-k2.5",                  narrator: "kimi-k2.5" },
  ernie:      { opener: "ernie-4.5-turbo-128k",     gm: "ernie-4.5-turbo-32k",        narrator: "ernie-4.5-turbo-32k" },
  mistral:    { opener: "mistral-large-latest",     gm: "mistral-medium-latest",      narrator: "mistral-medium-latest" },
  groq:       { opener: "llama-3.3-70b-versatile",  gm: "llama-3.3-70b-versatile",    narrator: "llama-3.3-70b-versatile" },
  openrouter: { opener: "deepseek/deepseek-v4-flash:free", gm: "deepseek/deepseek-v4-flash:free", narrator: "deepseek/deepseek-v4-flash:free" },
  cerebras:   { opener: "gpt-oss-120b",             gm: "gpt-oss-120b",               narrator: "gpt-oss-120b" },
  local:      { opener: "llama3.2",                 gm: "llama3.1",                   narrator: "llama3.2" }
};
/** @returns {string} */
export var getLocalUrl = () => localStorage.getItem(PROVIDER_META.local.urlStorage)?.trim() || LOCAL_DEFAULT_URL;
/**
 * @param {ProviderId} id
 * @returns {Promise<string>}
 */
export var getProviderKey = async (id) => {
  const m = PROVIDER_META[id];
  if (!m)
    throw new BorrowedError("The hour cannot open yet.", `Unknown API provider "${id}".`);
  const injected = window[m.windowKey] || /** @type {HTMLMetaElement | null} */ (document.querySelector(`meta[name="${m.metaName}"]`))?.content;
  if (injected)
    return injected.trim();
  const stored = localStorage.getItem(m.keyStorage);
  if (stored) {
    if (!stored.startsWith(ENC_PREFIX))
      return stored.trim();
    if (!window.__sessionPassphrase) {
      const { requestPassphrase } = await import("../passphrase.js");
      window.__sessionPassphrase = await requestPassphrase("Enter your session passphrase to unlock API keys:");
    }
    if (!window.__sessionPassphrase)
      throw new BorrowedError("The hour cannot open yet.", "A session passphrase is required to unlock your API key.");
    try {
      return (await decryptSecret(stored, window.__sessionPassphrase)).trim();
    } catch {
      window.__sessionPassphrase = null;
      throw new BorrowedError("The hour cannot open yet.", "Could not unlock the API key — wrong passphrase. Try again.");
    }
  }
  if (m.keyOptional)
    return "";
  throw new BorrowedError("The hour cannot open yet.", `No ${m.name} API key is saved. Open ⚙ Settings → API keys and paste your key there.`);
};
/** @param {ProviderId} id */
export var resetProviderKey = (id) => {
  const m = PROVIDER_META[id];
  if (m)
    localStorage.removeItem(m.keyStorage);
};

/**
 * Lightweight connectivity check: resolves key, then fires a tiny
 * request to the provider's endpoint. Returns { ok, detail }.
 * @param {ProviderId} id
 * @param {string} [model]
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export var checkProviderHealth = async (id, model) => {
  const m = PROVIDER_META[id];
  if (!m) return { ok: false, detail: `Unknown provider "${id}".` };
  let apiKey;
  try {
    apiKey = await getProviderKey(id);
  } catch (e) {
    return { ok: false, detail: e instanceof BorrowedError ? (e.detail || e.message) : String(e) };
  }
  if (!apiKey && !m.keyOptional) return { ok: false, detail: `No API key configured for ${m.name}.` };
  const provider = PROVIDERS[id];
  if (!provider) return { ok: false, detail: `No adapter registered for ${m.name}.` };
  const testModel = model || m.models[0]?.id || "";
  try {
    const request = provider.buildRequest({
      sys: "Reply with exactly: ok",
      msgs: [{ role: "user", content: "Ping." }],
      useTool: false, model: testModel, maxTokens: 4, temperature: 0, tool: null, apiKey
    });
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
    if (e?.name === "AbortError") return { ok: false, detail: `${m.name} did not respond within 10 seconds.` };
    const msg = e?.message || String(e);
    const isCORS = /failed to fetch|networkerror|cors|load failed/i.test(msg);
    if (isCORS && id === "local") {
      return { ok: false, detail: `Could not reach the local LLM endpoint. If using Ollama, set OLLAMA_ORIGINS to your app's origin (e.g. http://localhost:5173). For LM Studio, enable CORS in the server settings.` };
    }
    return { ok: false, detail: `Network error reaching ${m.name}: ${msg}` };
  }
};

/** @type {Record<string, any>} */
export var PROVIDERS = {
  openai: {
    toolUse: true,
    retryable: new Set([408, 409, 429, 500, 502, 503, 504]),
    buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }) {
      const body = {
        model,
        input: normalizeOpenAIMessages(sys, msgs),
        max_output_tokens: maxTokens
      };
      if (temperature !== undefined)
        body.temperature = temperature;
      if (useTool) {
        body.text = {
          format: {
            type: "json_schema",
            name: tool.name,
            schema: tool.input_schema,
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
    logUsage(data, model) {
      if (!data.usage)
        return;
      const u = data.usage;
      console.debug("[borrowed] usage", {
        model,
        input: u.input_tokens || 0,
        cached_input: u.input_tokens_details?.cached_tokens || 0,
        output: u.output_tokens || 0,
        total: u.total_tokens || 0
      });
    },
    buildStreamRequest(params) {
      const request = this.buildRequest({ ...params, useTool: false, tool: _getGMTool() });
      request.body.stream = true;
      return request;
    },
    parseStreamEvent(rawEvent) {
      const data = sseEventData(rawEvent);
      if (!data || data === "[DONE]")
        return null;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        return null;
      }
      const out = {};
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
    extract(data) {
      const text = extractOpenAIText(data);
      if (!text) {
        const status = data.status || "unknown";
        const incomplete = data.incomplete_details?.reason ? ` Reason: ${data.incomplete_details.reason}.` : "";
        throw new BorrowedError("The page came back blank.", `OpenAI returned an empty response. Status: ${status}.${incomplete}`);
      }
      return text;
    }
  },
  gemini: {
    toolUse: true,
    retryable: new Set([408, 409, 429, 500, 502, 503, 504]),
    buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }) {
      const generationConfig = { maxOutputTokens: maxTokens };
      if (temperature !== undefined)
        generationConfig.temperature = temperature;
      if (useTool) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseJsonSchema = tool.input_schema;
      }
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: {
          systemInstruction: { parts: [{ text: sys }] },
          contents: normalizeGeminiMessages(msgs),
          generationConfig
        }
      };
    },
    logUsage(data, model) {
      if (!data.usageMetadata)
        return;
      const u = data.usageMetadata;
      console.debug("[borrowed] usage", {
        model,
        input: u.promptTokenCount || 0,
        cached_input: u.cachedContentTokenCount || 0,
        output: u.candidatesTokenCount || 0,
        total: u.totalTokenCount || 0
      });
    },
    buildStreamRequest({ sys, msgs, model, maxTokens, temperature, apiKey }) {
      const request = this.buildRequest({ sys, msgs, useTool: false, model, maxTokens, temperature, tool: _getGMTool(), apiKey });
      request.url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      return request;
    },
    parseStreamEvent(rawEvent) {
      const data = sseEventData(rawEvent);
      if (!data)
        return null;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        return null;
      }
      const out = {};
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
    extract(data) {
      const text = extractGeminiText(data);
      if (!text) {
        const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || "unknown";
        throw new BorrowedError("The page came back blank.", `Gemini returned an empty response. Reason: ${reason}.`);
      }
      return text;
    }
  },
  anthropic: {
    toolUse: true,
    retryable: new Set([408, 409, 429, 500, 502, 503, 504, 529]),
    buildRequest({ sys, msgs, useTool, model, maxTokens, temperature, tool, apiKey }) {
      const body = {
        model,
        max_tokens: maxTokens,
        system: [{ type: "text", text: sys, cache_control: { type: "ephemeral", ttl: "1h" } }],
        messages: normalizeClaudeMessages(msgs)
      };
      if (temperature !== undefined)
        body.temperature = temperature;
      if (useTool) {
        body.tools = [tool];
        body.tool_choice = { type: "tool", name: tool.name };
      }
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "extended-cache-ttl-2025-04-11"
        },
        body
      };
    },
    logUsage(data, model) {
      if (!data.usage)
        return;
      const u = data.usage;
      console.debug("[borrowed] usage", {
        model,
        input: u.input_tokens || 0,
        cache_read: u.cache_read_input_tokens || 0,
        cache_write: u.cache_creation_input_tokens || 0,
        output: u.output_tokens || 0
      });
    },
    buildStreamRequest(params) {
      const request = this.buildRequest({ ...params, useTool: false, tool: _getGMTool() });
      request.body.stream = true;
      return request;
    },
    parseStreamEvent(rawEvent) {
      const data = sseEventData(rawEvent);
      if (!data)
        return null;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        return null;
      }
      const out = {};
      if (json.type === "content_block_delta" && json.delta?.type === "text_delta" && typeof json.delta.text === "string")
        out.text = json.delta.text;
      if (json.type === "message_start" && json.message?.usage)
        out.usage = {
          input: json.message.usage.input_tokens || 0,
          output: json.message.usage.output_tokens || 0
        };
      if (json.type === "message_delta" && json.usage)
        out.usage = { output: json.usage.output_tokens || 0 };
      if (json.type === "error")
        out.error = json.error?.message || "stream error";
      return out;
    },
    extract(data, useTool, tool, maxTokens) {
      if (useTool) {
        const toolUse = (data.content || []).find((part) => part.type === "tool_use" && part.name === tool.name);
        if (toolUse) {
          if (data.stop_reason === "max_tokens") {
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
        const stop = data.stop_reason || "unknown";
        throw new BorrowedError("The page came back blank.", `Claude returned an empty response. Stop reason: ${stop}.`);
      }
      return text;
    }
  },
  deepseek: _mkCCP({
    url: "https://api.deepseek.com/chat/completions",
    label: "DeepSeek",
    tools: true,
    // DeepSeek V4 enables thinking by default, which rejects forced
    // tool_choice. Disable thinking so we can pin the model to the schema.
    extraBody: { thinking: { type: "disabled" } }
  }),
  qwen: _mkCCP({
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    label: "Qwen",
    tools: true
  }),
  kimi: _mkCCP({
    url: "https://api.moonshot.cn/v1/chat/completions",
    label: "Kimi",
    tools: true
  }),
  ernie: _mkCCP({
    url: "https://qianfan.baidubce.com/v2/chat/completions",
    label: "ERNIE",
    jsonSchema: false
  }),
  mistral: _mkCCP({
    url: "https://api.mistral.ai/v1/chat/completions",
    label: "Mistral",
    tools: true
  }),
  groq: _mkCCP({
    url: "https://api.groq.com/openai/v1/chat/completions",
    label: "Groq",
    tools: true
  }),
  openrouter: _mkCCP({
    url: "https://openrouter.ai/api/v1/chat/completions",
    label: "OpenRouter",
    tools: true
  }),
  cerebras: _mkCCP({
    url: "https://api.cerebras.ai/v1/chat/completions",
    label: "Cerebras",
    tools: true
  }),
  local: _mkCCP({
    url: () => getLocalUrl(),
    label: "Local LLM",
    jsonSchema: false
  })
};
/** @param {ProviderId} id @returns {boolean} */
export var providerSupportsToolUse = (id) => !!PROVIDERS[id]?.toolUse;
export var TOOL_USE_PROVIDER_ORDER = PROVIDER_ORDER.filter(providerSupportsToolUse);
