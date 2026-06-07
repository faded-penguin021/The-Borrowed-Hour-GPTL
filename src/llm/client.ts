import type { ChatMessage, EngineConfig, ProviderId, ThrownError, ToolDefinition } from "../types";
import { PROVIDERS, PROVIDER_META, getProviderKey } from "./providers";
import { GM_TOOL } from "./tools";
import { scrubSecrets, extractApiErrorMessage, BorrowedError, httpStatusHint } from "./errors";
import { createRateLimiter } from "./rateLimiter";
import { dlog } from "../debug/debugLog";

interface UsageData {
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
}

function extractUsage(d: UsageData, providerId: string): [number, number] {
  if (providerId === "gemini") {
    const u = d.usageMetadata;
    return [u?.promptTokenCount || 0, u?.candidatesTokenCount || 0];
  }
  if (providerId === "openai") {
    const u = d.usage;
    return [u?.input_tokens || 0, u?.output_tokens || 0];
  }
  const u = d.usage;
  return [
    u?.prompt_tokens || u?.input_tokens || 0,
    u?.completion_tokens || u?.output_tokens || 0,
  ];
}

/** Signature of the non-streaming `callAPI` returned by {@link createLLMClient}. */
export type CallAPI = (
  sys: string,
  msgs: ChatMessage[],
  useTool?: boolean,
  engine?: EngineConfig,
  maxTokens?: number,
  temperature?: number,
  signal?: AbortSignal | null,
  tool?: ToolDefinition,
  cacheBreakpoint?: number,
  cacheKey?: string,
) => Promise<string>;

/** Signature of the streaming `streamAPI` returned by {@link createLLMClient}. */
export type StreamAPI = (
  sys: string,
  msgs: ChatMessage[],
  engine: EngineConfig,
  maxTokens: number,
  temperature: number,
  signal: AbortSignal,
  onDelta: (delta: string) => void,
) => Promise<string>;

/**
 * Build the API layer (callAPI / streamAPI). Kept free of React so the game
 * loop and the codex hook can share one client. Token usage is reported back
 * through `onUsage` rather than written into component state directly.
 */
export function createLLMClient({ getDefaultEngine, onUsage, getProxyUrl }: {
  getDefaultEngine: () => EngineConfig;
  onUsage: (input: number, output: number) => void;
  getProxyUrl?: () => (string | undefined);
}) {
  /**
   * BYOB proxy interceptor. If the user configured a proxy URL, rewrite the
   * request to route through their backend (`<proxy>?target=<encoded origin>`)
   * and strip every browser-held key header so the secret never leaves the
   * device — the proxy is expected to attach its own credentials server-side.
   * Mutates and returns the same request object. Leaves the body untouched, so
   * stream requests (`stream: true`) are forwarded verbatim and `streamAPI`'s
   * SSE parsing keeps reading whatever the proxy pipes back.
   */
  const applyProxy = <T extends { url: string; headers: Record<string, string> }>(request: T): T => {
    const proxyUrl = getProxyUrl?.()?.trim();
    if (!proxyUrl) return request;
    request.url = `${proxyUrl}?target=${encodeURIComponent(request.url)}`;
    if (request.headers) {
      delete request.headers["Authorization"];
      delete request.headers["x-api-key"];
      delete request.headers["x-goog-api-key"];
    }
    return request;
  };

  const limiter = createRateLimiter();

  const callAPI = async (sys: string, msgs: ChatMessage[], useTool = false, engine: EngineConfig = getDefaultEngine(), maxTokens = 3000, temperature = 0.6, signal: AbortSignal | null = null, tool: ToolDefinition = GM_TOOL, cacheBreakpoint?: number, cacheKey?: string): Promise<string> => {
    await limiter.acquire(signal ?? undefined);
    const providerId = engine?.provider;
    const model = engine?.model;
    const provider = PROVIDERS[providerId];
    const meta = PROVIDER_META[providerId as ProviderId];
    if (!provider || !meta || !model || !String(model).trim()) {
      throw new BorrowedError("The hour cannot open yet.", "No story engine is selected. Open Settings → Story engines and choose a provider and a model.");
    }
    let temp: number | undefined = temperature;
    const RETRYABLE = provider.retryable;
    const MAX_RETRIES = 2;
    let res: Response | null = null;
    let lastErr: BorrowedError | null = null;
    let lastStatus: number | null = null;
    let lastBodySnippet: string | null = null;
    for (let attempt = 0;attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0)
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt) + Math.random() * 300));
      if (signal && signal.aborted) {
        throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
      }
      let request;
      let apiKey: string | null = null;
      try {
        apiKey = await getProviderKey(providerId as ProviderId);
        request = provider.buildRequest({
          sys, msgs, useTool, model, maxTokens, temperature: temp, tool, apiKey, cacheBreakpoint, cacheKey
        });
      } catch (e) {
        if (e instanceof BorrowedError) throw e;
        const caught = e as ThrownError;
        throw new BorrowedError("The hour falters.", `Could not build the ${meta.name} request${caught?.message ? ` (${caught.message})` : ""}.`);
      }
      applyProxy(request);
      try {
        res = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: signal || undefined
        });
        if (res.ok) { lastErr = null; break; }
        lastStatus = res.status;
        try {
          const bodyText = await res.text();
          lastBodySnippet = scrubSecrets(bodyText.slice(0, 500), apiKey);
        } catch (e) { dlog("llm:body-read-error", e); }
        if (res.status === 400 && temp !== undefined && /temperature/i.test(lastBodySnippet || "")) {
          temp = undefined;
          lastErr = new BorrowedError("The hour falters.", `${meta.name} rejected temperature for this model; retrying with the model default.`);
          res = null;
          continue;
        }
        const hint = httpStatusHint(res.status, meta.name);
        const apiMsg = extractApiErrorMessage(lastBodySnippet);
        const detailedHint = apiMsg ? `${hint} ${meta.name} said: ${apiMsg}` : hint;
        if (!RETRYABLE.has(res.status))
          throw new BorrowedError("The hour falters.", detailedHint);
        lastErr = new BorrowedError("The hour falters.", attempt < MAX_RETRIES ? `${detailedHint} Retrying…` : `${detailedHint} Retried ${MAX_RETRIES} times without success.`);
        res = null;
      } catch (e) {
        const caught = e as ThrownError;
        if (caught && caught.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        if (e instanceof BorrowedError) throw e;
        const netMsg = caught?.message || "";
        const isCORS = /failed to fetch|networkerror|cors|load failed/i.test(netMsg);
        const corsHint = isCORS && providerId === "local"
          ? ` If using Ollama, set OLLAMA_ORIGINS to this page's origin (e.g. ${location.origin}). For LM Studio, enable CORS in server settings.`
          : "";
        lastErr = new BorrowedError("The hour falters.", `Network error before the ${meta.name} API responded${netMsg ? ` (${netMsg})` : ""}.${corsHint || " Check your connection, CORS/proxy policy, and API key."}`);
        res = null;
      }
    }
    if (!res) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[borrowed] ${meta.name} API failure`, { status: lastStatus, body: lastBodySnippet });
      }
      throw lastErr || new BorrowedError("The hour falters.", "Unknown failure.");
    }
    const data: unknown = await res.json();
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      try { provider.logUsage(data, model); } catch {}
    }
    try {
      const d = data as UsageData;
      const [inp, out] = extractUsage(d, providerId);
      if (!inp && !out) dlog("llm:usage-zero", providerId, model);
      onUsage(inp, out);
    } catch (e) { dlog("llm:usage-extract-error", e); }
    return provider.extract(data, useTool, tool, maxTokens);
  };

  const streamAPI = async (sys: string, msgs: ChatMessage[], engine: EngineConfig, maxTokens: number, temperature: number, signal: AbortSignal, onDelta: (delta: string) => void): Promise<string> => {
    await limiter.acquire(signal);
    const providerId = engine?.provider;
    const model = engine?.model;
    const provider = PROVIDERS[providerId];
    const meta = PROVIDER_META[providerId as ProviderId];
    if (!provider || !meta || !model || !String(model).trim()) {
      throw new BorrowedError("The hour cannot open yet.", "No story engine is selected. Open Settings → Story engines and choose a provider and a model.");
    }
    if (typeof provider.buildStreamRequest !== "function" || typeof provider.parseStreamEvent !== "function") {
      const fallback = await callAPI(sys, msgs, false, engine, maxTokens, temperature, signal);
      if (fallback) onDelta(fallback);
      return fallback;
    }
    // Bind to `provider` so `this` survives: makeChatCompletionsProvider's
    // buildStreamRequest calls `this.buildRequest(...)`. A bare reference would
    // leave `this` undefined and crash with
    // "Cannot read properties of undefined (reading 'buildRequest')".
    const buildStreamRequest = provider.buildStreamRequest.bind(provider);
    const parseStreamEvent = provider.parseStreamEvent.bind(provider);
    let temp: number | undefined = temperature;
    const RETRYABLE = provider.retryable;
    const MAX_RETRIES = 2;
    let lastErr: BorrowedError | null = null;
    for (let attempt = 0;attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0)
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt) + Math.random() * 300));
      if (signal && signal.aborted) {
        throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
      }
      let request;
      let apiKey: string | null = null;
      try {
        apiKey = await getProviderKey(providerId as ProviderId);
        request = buildStreamRequest({ sys, msgs, model, maxTokens, temperature: temp, apiKey });
      } catch (e) {
        if (e instanceof BorrowedError) throw e;
        const caught = e as ThrownError;
        throw new BorrowedError("The hour falters.", `Could not build the ${meta.name} request${caught?.message ? ` (${caught.message})` : ""}.`);
      }
      applyProxy(request);
      let res;
      try {
        res = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: signal || undefined
        });
      } catch (e) {
        const caught = e as ThrownError;
        if (caught && caught.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        const netMsg = caught?.message || "";
        const isCORS = /failed to fetch|networkerror|cors|load failed/i.test(netMsg);
        const corsHint = isCORS && providerId === "local"
          ? ` If using Ollama, set OLLAMA_ORIGINS to this page's origin (e.g. ${location.origin}). For LM Studio, enable CORS in server settings.`
          : "";
        lastErr = new BorrowedError("The hour falters.", `Network error before the ${meta.name} API responded${netMsg ? ` (${netMsg})` : ""}.${corsHint || " Check your connection, CORS/proxy policy, and API key."}`);
        continue;
      }
      if (!res.ok) {
        let bodySnippet: string | null = null;
        try { bodySnippet = scrubSecrets((await res.text()).slice(0, 500), apiKey); } catch {}
        if (res.status === 400 && temp !== undefined && /temperature/i.test(bodySnippet || "")) {
          temp = undefined;
          lastErr = new BorrowedError("The hour falters.", `${meta.name} rejected temperature for this model; retrying with the model default.`);
          continue;
        }
        const hint = httpStatusHint(res.status, meta.name);
        const apiMsg = extractApiErrorMessage(bodySnippet);
        const detailedHint = apiMsg ? `${hint} ${meta.name} said: ${apiMsg}` : hint;
        if (!RETRYABLE.has(res.status))
          throw new BorrowedError("The hour falters.", detailedHint);
        lastErr = new BorrowedError("The hour falters.", attempt < MAX_RETRIES ? `${detailedHint} Retrying…` : `${detailedHint} Retried ${MAX_RETRIES} times without success.`);
        continue;
      }
      if (!res.body) {
        throw new BorrowedError("The hour falters.", `${meta.name} returned no readable stream body.`);
      }
      let full = "";
      let usage: { input?: number; output?: number } | null = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder;
      let buffer = "";
      const STALL_MS = 60000;
      let stalled = false;
      let stallTimer: ReturnType<typeof setTimeout> | null = null;
      const armStall = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          stalled = true;
          try { reader.cancel("stream stalled"); } catch {}
        }, STALL_MS);
      };
      const clearStall = () => {
        if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
      };
      const handleEvent = (rawEvent: string) => {
        if (!rawEvent.trim()) return;
        const lines = rawEvent.split("\n");
        const filtered = lines.filter((l) => !l.startsWith(":"));
        if (filtered.length === 0) return;
        const cleaned = filtered.join("\n");
        const parsed = parseStreamEvent(cleaned);
        if (!parsed) return;
        if (parsed.usage) usage = (Object.assign(usage || {}, parsed.usage) as { input?: number; output?: number });
        if (parsed.error)
          throw new BorrowedError("The hour falters.", `${meta.name} reported an error mid-stream: ${parsed.error}`);
        if (parsed.text) {
          full += parsed.text;
          onDelta(parsed.text);
        }
      };
      armStall();
      try {
        while (true) {
          const { done, value } = await reader.read();
          armStall();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            handleEvent(rawEvent);
          }
        }
        handleEvent(buffer);
      } catch (e) {
        try { reader.cancel(); } catch {}
        const caught = e as ThrownError;
        if (stalled) {
          const err: BorrowedError & { partial?: string } = new BorrowedError("The hour falters.", `The ${meta.name} narration stream went silent for ${Math.round(STALL_MS/1000)}s — likely the connection was dropped while the tab was in the background. Try again.`);
          if (full) err.partial = full;
          throw err;
        }
        if (caught && caught.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        const err: BorrowedError & { partial?: string } = e instanceof BorrowedError ? e : new BorrowedError("The hour falters.", `The ${meta.name} narration stream broke${caught?.message ? ` (${caught.message})` : ""}.`);
        if (full) err.partial = full;
        throw err;
      } finally {
        clearStall();
        if (usage) onUsage((usage as { input?: number; output?: number }).input || 0, (usage as { input?: number; output?: number }).output || 0);
      }
      if (!full.trim())
        throw new BorrowedError("The page came back blank.", `${meta.name} returned an empty narration stream.`);
      return full;
    }
    throw lastErr || new BorrowedError("The hour falters.", "Unknown failure.");
  };

  return { callAPI, streamAPI };
}
