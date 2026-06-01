// @ts-check
/**
 * @import { ChatMessage, EngineConfig, ProviderId, ThrownError, ToolDefinition } from "../types"
 */
import { PROVIDERS, PROVIDER_META, getProviderKey } from "./providers.js";
import { GM_TOOL } from "./tools.js";
import { scrubSecrets, extractApiErrorMessage, BorrowedError, httpStatusHint } from "./errors.js";

/**
 * Build the API layer (callAPI / streamAPI). Kept free of React so the game
 * loop and the codex hook can share one client. Token usage is reported back
 * through `onUsage` rather than written into component state directly.
 *
 * @param {{
 *   getDefaultEngine: () => EngineConfig,
 *   onUsage: (input: number, output: number) => void,
 *   getProxyUrl?: () => (string | undefined),
 * }} deps
 */
export function createLLMClient({ getDefaultEngine, onUsage, getProxyUrl }) {
  /**
   * BYOB proxy interceptor. If the user configured a proxy URL, rewrite the
   * request to route through their backend (`<proxy>?target=<encoded origin>`)
   * and strip every browser-held key header so the secret never leaves the
   * device — the proxy is expected to attach its own credentials server-side.
   * Mutates and returns the same request object. Leaves the body untouched, so
   * stream requests (`stream: true`) are forwarded verbatim and `streamAPI`'s
   * SSE parsing keeps reading whatever the proxy pipes back.
   * @template {{ url: string, headers: Record<string, string> }} T
   * @param {T} request
   * @returns {T}
   */
  const applyProxy = (request) => {
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

  /** @param {string} sys @param {ChatMessage[]} msgs @param {boolean} [useTool] @param {EngineConfig} [engine] @param {number} [maxTokens] @param {number} [temperature] @param {AbortSignal|null} [signal] @param {ToolDefinition} [tool] @returns {Promise<string>} */
  const callAPI = async (sys, msgs, useTool = false, engine = getDefaultEngine(), maxTokens = 3000, temperature = 0.6, signal = null, tool = GM_TOOL) => {
    const providerId = engine?.provider;
    const model = engine?.model;
    const provider = PROVIDERS[providerId];
    const meta = PROVIDER_META[/** @type {ProviderId} */ (providerId)];
    if (!provider || !meta || !model || !String(model).trim()) {
      throw new BorrowedError("The hour cannot open yet.", "No story engine is selected. Open Settings → Story engines and choose a provider and a model.");
    }
    /** @type {number | undefined} */
    let temp = temperature;
    const RETRYABLE = provider.retryable;
    const MAX_RETRIES = 2;
    let res = null;
    let lastErr = null;
    let lastStatus = null;
    let lastBodySnippet = null;
    for (let attempt = 0;attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0)
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt) + Math.random() * 300));
      if (signal && signal.aborted) {
        throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
      }
      let request;
      let apiKey = null;
      try {
        apiKey = await getProviderKey(/** @type {ProviderId} */ (providerId));
        request = provider.buildRequest({
          sys, msgs, useTool, model, maxTokens, temperature: temp, tool, apiKey
        });
      } catch (e) {
        if (e instanceof BorrowedError) throw e;
        const caught = /** @type {ThrownError} */ (e);
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
        } catch {}
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
        const caught = /** @type {ThrownError} */ (e);
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
    const data = await res.json();
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      try { provider.logUsage(data, model); } catch {}
    }
    try {
      let inp = 0, out = 0;
      if (providerId === "gemini") {
        const u = data.usageMetadata;
        inp = u?.promptTokenCount || 0;
        out = u?.candidatesTokenCount || 0;
      } else if (providerId === "openai") {
        const u = data.usage;
        inp = u?.input_tokens || 0;
        out = u?.output_tokens || 0;
      } else {
        const u = data.usage;
        inp = u?.prompt_tokens || u?.input_tokens || 0;
        out = u?.completion_tokens || u?.output_tokens || 0;
      }
      onUsage(inp, out);
    } catch {}
    return provider.extract(data, useTool, tool, maxTokens);
  };

  /** @param {string} sys @param {ChatMessage[]} msgs @param {EngineConfig} engine @param {number} maxTokens @param {number} temperature @param {AbortSignal} signal @param {(delta: string) => void} onDelta @returns {Promise<string>} */
  const streamAPI = async (sys, msgs, engine, maxTokens, temperature, signal, onDelta) => {
    const providerId = engine?.provider;
    const model = engine?.model;
    const provider = PROVIDERS[providerId];
    const meta = PROVIDER_META[/** @type {ProviderId} */ (providerId)];
    if (!provider || !meta || !model || !String(model).trim()) {
      throw new BorrowedError("The hour cannot open yet.", "No story engine is selected. Open Settings → Story engines and choose a provider and a model.");
    }
    if (typeof provider.buildStreamRequest !== "function" || typeof provider.parseStreamEvent !== "function") {
      const fallback = await callAPI(sys, msgs, false, engine, maxTokens, temperature, signal);
      if (fallback) onDelta(fallback);
      return fallback;
    }
    /** @type {number | undefined} */
    let temp = temperature;
    const RETRYABLE = provider.retryable;
    const MAX_RETRIES = 2;
    let lastErr = null;
    for (let attempt = 0;attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0)
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt) + Math.random() * 300));
      if (signal && signal.aborted) {
        throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
      }
      let request;
      let apiKey = null;
      try {
        apiKey = await getProviderKey(/** @type {ProviderId} */ (providerId));
        request = provider.buildStreamRequest({ sys, msgs, model, maxTokens, temperature: temp, apiKey });
      } catch (e) {
        if (e instanceof BorrowedError) throw e;
        const caught = /** @type {ThrownError} */ (e);
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
        const caught = /** @type {ThrownError} */ (e);
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
        let bodySnippet = null;
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
      /** @type {{ input?: number, output?: number } | null} */
      let usage = /** @type {{ input?: number, output?: number } | null} */ (null);
      const reader = res.body.getReader();
      const decoder = new TextDecoder;
      let buffer = "";
      const STALL_MS = 60000;
      let stalled = false;
      /** @type {ReturnType<typeof setTimeout> | null} */
      let stallTimer = null;
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
      /** @param {string} rawEvent */
      const handleEvent = (rawEvent) => {
        if (!rawEvent.trim()) return;
        const parsed = provider.parseStreamEvent(rawEvent);
        if (!parsed) return;
        if (parsed.usage) usage = /** @type {{ input?: number, output?: number }} */ (Object.assign(usage || {}, parsed.usage));
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
          buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
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
        const caught = /** @type {ThrownError} */ (e);
        if (stalled) {
          /** @type {BorrowedError & { partial?: string }} */
          const err = new BorrowedError("The hour falters.", `The ${meta.name} narration stream went silent for ${Math.round(STALL_MS/1000)}s — likely the connection was dropped while the tab was in the background. Try again.`);
          if (full) err.partial = full;
          throw err;
        }
        if (caught && caught.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        /** @type {BorrowedError & { partial?: string }} */
        const err = e instanceof BorrowedError ? e : new BorrowedError("The hour falters.", `The ${meta.name} narration stream broke${caught?.message ? ` (${caught.message})` : ""}.`);
        if (full) err.partial = full;
        throw err;
      } finally {
        clearStall();
      }
      if (usage) onUsage(usage.input || 0, usage.output || 0);
      if (!full.trim())
        throw new BorrowedError("The page came back blank.", `${meta.name} returned an empty narration stream.`);
      return full;
    }
    throw lastErr || new BorrowedError("The hour falters.", "Unknown failure.");
  };

  return { callAPI, streamAPI };
}
