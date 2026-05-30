import React, { useState, useRef, useEffect } from "react";
import { EMPTY_STATE, SETTINGS_KEY, SAVE_PREFIX, SAVE_CAP, APPROX_CHARS_PER_TOKEN, estimateSize, formatKB, formatTokens, VALID_ENDINGS } from "./data/constants.js";
import { DEFAULT_LANGUAGE, languageNameFor, LANGUAGES } from "./data/languages.js";
import { PREMISES, buildCustomPremise, NARRATION_LOADING_PHRASES, META_LOADING_PHRASES, OPENING_LOADING_PHRASES, pickPhrase } from "./data/premises.js";
import { PROVIDERS, PROVIDER_META, PROVIDER_ORDER, providerSupportsToolUse, FREE_MODELS_BY_PROVIDER, getProviderKey, getLocalUrl } from "./llm/providers.js";
import { GM_TOOL, GM_LOGIC_TOOL, buildSystem, buildNarratorSystem, buildMetaSystem } from "./llm/tools.js";
import { parseGMResponse, parseGMLogicResponse, isStateEmpty } from "./llm/parse.js";
import { formatStateForPrompt, stripHistoricalUser, stripHistoricalAssistant, serializeStatePublic } from "./llm/prompt.js";
import { formatError, scrubSecrets, extractApiErrorMessage, BorrowedError, httpStatusHint } from "./llm/errors.js";
import { TitleScreen } from "./components/TitleScreen.jsx";
import { GameScreen } from "./components/GameScreen.jsx";
import { SavesModal } from "./components/modals/SavesModal.jsx";
import { SettingsModal } from "./components/modals/SettingsModal.jsx";
import { LedgerModal } from "./components/modals/LedgerModal.jsx";
import { ExportFallbackModal } from "./components/modals/ExportFallbackModal.jsx";
import { PassphraseModal } from "./components/PassphraseModal.jsx";
import { CustomModal } from "./components/modals/CustomModal.jsx";
import { ErrorRawDetail } from "./components/ErrorRawDetail.jsx";
import { useSettings } from "./hooks/useSettings.js";
import { useAmbience } from "./hooks/useAmbience.js";
import { useTTS } from "./hooks/useTTS.js";
import { useCodex } from "./hooks/useCodex.js";
import { useSaves } from "./hooks/useSaves.js";
import { useViewport } from "./hooks/useViewport.js";

export function App() {
  const [phase, setPhase] = useState("title");
  const [premise, setPremise] = useState(null);
  const [entries, setEntries] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ended, setEnded] = useState(false);
  const [gameState, setGameState] = useState(EMPTY_STATE);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [showLedger, setShowLedger] = useState(false);
  const [inputHistory, setInputHistory] = useState([]);
  const [inputHistoryIndex, setInputHistoryIndex] = useState(-1);
  const [metaMode, setMetaMode] = useState(false);
  const [metaMessages, setMetaMessages] = useState([]);
  const [skipNonce, setSkipNonce] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 });
  const sessionTokensRef = useRef({ input: 0, output: 0 });

  // ── Domain hooks ─────────────────────────────────────────────────
  const { settings, updateSetting } = useSettings();

  const {
    ambienceLevel, ambienceMuted, ambienceUnavailable,
    ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceMusicLevel,
    ambienceRef, ambienceEngineNonce,
    setAmbienceLevel, setAmbienceMuted,
    setAmbienceDuringNarrationOnly, setAmbienceBoostWithTTS, setAmbienceMusicLevel,
    ensureAmbienceEngine,
  } = useAmbience();

  const tts = useTTS({ showSettings });

  const [osReducedMotion, setOsReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setOsReducedMotion(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);
  const instantReveal = settings.disableTypewriter || osReducedMotion;

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  useViewport();

  // ── API layer ────────────────────────────────────────────────────
  /** @param {string} sys @param {ChatMessage[]} msgs @param {boolean} [useTool] @param {EngineConfig} [engine] @param {number} [maxTokens] @param {number} [temperature] @param {AbortSignal|null} [signal] @param {ToolDefinition} [tool] @returns {Promise<string>} */
  const callAPI = async (sys, msgs, useTool = false, engine = settings.engineNarrator, maxTokens = 3000, temperature = 0.6, signal = null, tool = GM_TOOL) => {
    const providerId = engine?.provider;
    const model = engine?.model;
    const provider = PROVIDERS[providerId];
    const meta = PROVIDER_META[providerId];
    if (!provider || !meta || !model || !String(model).trim()) {
      throw new BorrowedError("The hour cannot open yet.", "No story engine is selected. Open Settings → Story engines and choose a provider and a model.");
    }
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
      try {
        const apiKey = await getProviderKey(providerId);
        request = provider.buildRequest({
          sys, msgs, useTool, model, maxTokens, temperature: temp, tool, apiKey
        });
      } catch (e) {
        if (e instanceof BorrowedError) throw e;
        throw new BorrowedError("The hour falters.", `Could not build the ${meta.name} request${e?.message ? ` (${e.message})` : ""}.`);
      }
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
          lastBodySnippet = scrubSecrets(bodyText.slice(0, 500));
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
        if (e && e.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        if (e instanceof BorrowedError) throw e;
        lastErr = new BorrowedError("The hour falters.", `Network error before the ${meta.name} API responded${e?.message ? ` (${e.message})` : ""}. Check your connection, CORS/proxy policy, and API key.`);
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
    if (typeof console !== "undefined" && console.debug) {
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
      if (inp || out) {
        sessionTokensRef.current = {
          input: sessionTokensRef.current.input + inp,
          output: sessionTokensRef.current.output + out
        };
        setSessionTokens({ ...sessionTokensRef.current });
      }
    } catch {}
    return provider.extract(data, useTool, tool, maxTokens);
  };

  /** @param {string} sys @param {ChatMessage[]} msgs @param {EngineConfig} engine @param {number} maxTokens @param {number} temperature @param {AbortSignal} signal @param {(delta: string) => void} onDelta @returns {Promise<string>} */
  const streamAPI = async (sys, msgs, engine, maxTokens, temperature, signal, onDelta) => {
    const providerId = engine?.provider;
    const model = engine?.model;
    const provider = PROVIDERS[providerId];
    const meta = PROVIDER_META[providerId];
    if (!provider || !meta || !model || !String(model).trim()) {
      throw new BorrowedError("The hour cannot open yet.", "No story engine is selected. Open Settings → Story engines and choose a provider and a model.");
    }
    if (typeof provider.buildStreamRequest !== "function" || typeof provider.parseStreamEvent !== "function") {
      const fallback = await callAPI(sys, msgs, false, engine, maxTokens, temperature, signal);
      if (fallback) onDelta(fallback);
      return fallback;
    }
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
      try {
        const apiKey = await getProviderKey(providerId);
        request = provider.buildStreamRequest({ sys, msgs, model, maxTokens, temperature: temp, apiKey });
      } catch (e) {
        if (e instanceof BorrowedError) throw e;
        throw new BorrowedError("The hour falters.", `Could not build the ${meta.name} request${e?.message ? ` (${e.message})` : ""}.`);
      }
      let res;
      try {
        res = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: signal || undefined
        });
      } catch (e) {
        if (e && e.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        lastErr = new BorrowedError("The hour falters.", `Network error before the ${meta.name} API responded${e?.message ? ` (${e.message})` : ""}. Check your connection, CORS/proxy policy, and API key.`);
        continue;
      }
      if (!res.ok) {
        let bodySnippet = null;
        try { bodySnippet = scrubSecrets((await res.text()).slice(0, 500)); } catch {}
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
      let usage = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder;
      let buffer = "";
      const STALL_MS = 60000;
      let stalled = false;
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
      const handleEvent = (rawEvent) => {
        if (!rawEvent.trim()) return;
        const parsed = provider.parseStreamEvent(rawEvent);
        if (!parsed) return;
        if (parsed.usage) usage = Object.assign(usage || {}, parsed.usage);
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
        if (stalled) {
          const err = new BorrowedError("The hour falters.", `The ${meta.name} narration stream went silent for ${Math.round(STALL_MS/1000)}s — likely the connection was dropped while the tab was in the background. Try again.`);
          if (full) err.partial = full;
          throw err;
        }
        if (e && e.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        const err = e instanceof BorrowedError ? e : new BorrowedError("The hour falters.", `The ${meta.name} narration stream broke${e?.message ? ` (${e.message})` : ""}.`);
        if (full) err.partial = full;
        throw err;
      } finally {
        clearStall();
      }
      if (usage && (usage.input || usage.output)) {
        sessionTokensRef.current = {
          input: sessionTokensRef.current.input + (usage.input || 0),
          output: sessionTokensRef.current.output + (usage.output || 0)
        };
        setSessionTokens({ ...sessionTokensRef.current });
      }
      if (!full.trim())
        throw new BorrowedError("The page came back blank.", `${meta.name} returned an empty narration stream.`);
      return full;
    }
    throw lastErr || new BorrowedError("The hour falters.", "Unknown failure.");
  };

  // ── Codex hook (needs callAPI) ───────────────────────────────────
  const codex = useCodex({ callAPI, settings, premise, language, setEntries });

  // ── Saves hook ───────────────────────────────────────────────────
  const saves = useSaves();

  // ── Ambience↔TTS coupling ───────────────────────────────────────
  useEffect(() => {
    ambienceRef.current?.setSpeechGate(ambienceDuringNarrationOnly && tts.ttsEnabled);
  }, [ambienceDuringNarrationOnly, tts.ttsEnabled, ambienceEngineNonce]);

  useEffect(() => {
    ambienceRef.current?.setBoost(ambienceBoostWithTTS && tts.ttsEnabled);
  }, [ambienceBoostWithTTS, tts.ttsEnabled, ambienceEngineNonce]);

  useEffect(() => {
    const ctrl = tts.ttsRef.current;
    const eng = ambienceRef.current;
    if (!ctrl || !eng) return;
    const u1 = ctrl.onSpeakStart(() => eng.notifySpeechStart());
    const u2 = ctrl.onSpeakEnd(() => eng.notifySpeechEnd());
    return () => { u1(); u2(); };
  }, [tts.ttsEnabled, ambienceLevel, ambienceEngineNonce]);

  // Auto-speak entries.
  useEffect(() => {
    tts.autoSpeak(entries);
  }, [entries, tts.ttsEnabled, tts.ttsMuted, tts.ttsProviderId]);

  // Late-enable ambience during play.
  useEffect(() => {
    const eng = ambienceRef.current;
    if (eng) return;
    if (ambienceLevel !== "off" && phase === "playing" && premise) {
      (async () => {
        const built = await ensureAmbienceEngine();
        if (built) {
          const { defaultAmbienceForRealm, deriveAmbienceFromSeed } = await import("./ambience/tables.js");
          const bed = (premise.realm === "wild" && premise.seed)
            ? deriveAmbienceFromSeed(premise.seed)
            : defaultAmbienceForRealm(premise.realm);
          built.applyAmbience(bed);
        }
      })();
    }
  }, [ambienceLevel]);

  // ── Scroll / visibility / banner effects ─────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [entries, loading, metaMessages]);

  useEffect(() => {
    const STALE_AFTER_MS = 90000;
    const onVisibility = () => {
      if (document.hidden) return;
      const ref = abortRef.current;
      if (!ref) return;
      const age = Date.now() - (ref.startedAt || 0);
      if (age > STALE_AFTER_MS) {
        try { ref.controller.abort(); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!saves.saveBanner) return;
    const t = setTimeout(() => saves.setSaveBanner(null), 2400);
    return () => clearTimeout(t);
  }, [saves.saveBanner]);

  // ── Game actions ─────────────────────────────────────────────────
  const skipReveal = () => setSkipNonce((n) => n + 1);

  const finalizeNarration = (narration, gmParsed, baseEntries, baseHistory, fullyRevealed) => {
    const assistantPayload = JSON.stringify({ gm_scratchpad: "", narration, state: gmParsed.state, ending: gmParsed.ending });
    setHistory([...baseHistory, { role: "assistant", content: assistantPayload }]);
    setEntries((prev) => {
      const existing = prev[baseEntries.length];
      const entry = { type: "narration", text: narration, fullyRevealed };
      if (existing && existing.illustration) entry.illustration = existing.illustration;
      return [...baseEntries, entry];
    });
    if (gmParsed.state && !(isStateEmpty(gmParsed.state) && !isStateEmpty(gameState))) {
      setGameState(gmParsed.state);
    }
    if (gmParsed.ending) setEnded(true);
  };

  /** @param {Premise} chosen @returns {Promise<void>} */
  const beginAdventure = async (chosen) => {
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    setPremise(chosen);
    setPhase("playing");
    setGameState(EMPTY_STATE);
    codex.resetCodex();
    setLoadingPhrase(pickPhrase(OPENING_LOADING_PHRASES));
    setLoading(true);
    setError(null);
    setRecovery(null);
    await ensureAmbienceEngine();
    const controller = new AbortController;
    const rollback = () => {
      setPhase("title");
      setPremise(null);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const sys = buildSystem(chosen, language);
      const msgs = [{ role: "user", content: "Begin." }];
      const bootstrapPromise = codex.runArtDirectorBootstrap(chosen, controller.signal);
      const firstRaw = await callAPI(sys, msgs, true, settings.engineOpening, 4500, 0.7, controller.signal);
      bootstrapPromise.catch(() => {});
      if (controller.signal.aborted) return;
      let openingRaw = firstRaw;
      let parsed = parseGMResponse(openingRaw);
      if (parsed.malformed) {
        const priorAssistant = (openingRaw && openingRaw.trim()) ? openingRaw : "(empty response)";
        const correctiveMsgs = [
          ...msgs,
          { role: "assistant", content: priorAssistant },
          { role: "user", content: `Your previous response could not be parsed. Reason: ${parsed.diagnostic || "missing required fields"}.

Call the tool \`narrate_and_update_state\` again. Required top-level fields: gm_scratchpad (string, keep it brief — under 120 words), narration (string, non-empty, the prose the player reads), state (object with: scene, time, inventory, npcs, clues, summary, hidden_state). Output ONLY the tool call / JSON object — no prose, no markdown fences.` }
        ];
        const retryRaw = await callAPI(sys, correctiveMsgs, true, settings.engineOpening, 7500, 0.4, controller.signal);
        if (controller.signal.aborted) return;
        openingRaw = retryRaw;
        parsed = parseGMResponse(openingRaw);
      }
      if (parsed.malformed) {
        const err = new BorrowedError("The hour stumbles in opening. Try once more.", parsed.diagnostic || "Tool response was malformed (likely truncated by max_tokens or missing required fields).");
        if (parsed.raw) err.raw = parsed.raw;
        throw err;
      }
      setHistory([...msgs, { role: "assistant", content: openingRaw }]);
      setEntries([{ type: "narration", text: parsed.narration, fullyRevealed: false }]);
      if (parsed.state) setGameState(parsed.state);
      if (parsed.ending) setEnded(true);
      if (ambienceRef.current) {
        const { defaultAmbienceForRealm, deriveAmbienceFromSeed } = await import("./ambience/tables.js");
        const bed = (chosen.realm === "wild" && chosen.seed)
          ? deriveAmbienceFromSeed(chosen.seed)
          : defaultAmbienceForRealm(chosen.realm);
        ambienceRef.current.applyAmbience(bed);
        if (parsed.ambience !== undefined)
          ambienceRef.current.applyAmbience(parsed.ambience);
      }
      if ((settings.codex?.mode || "off") !== "off") {
        bootstrapPromise.then(() => {
          if (controller.signal.aborted) return;
          return codex.runArtDirectorTurn({
            entryIndexProvider: () => 0,
            gmParsed: { state: parsed.state, narrator_brief: parsed.narration },
            signal: controller.signal,
            opener: true
          });
        }).catch(() => {});
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
      if (!cancelled) setError(formatError(e));
      rollback();
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  const continueNarration = async () => {
    const rec = recovery;
    if (!rec || loading) return;
    setError(null);
    setRecovery(null);
    setLoadingPhrase(pickPhrase(NARRATION_LOADING_PHRASES));
    setLoading(true);
    const narrationIndex = rec.baseEntries.length;
    let acc = rec.partial;
    const controller = new AbortController;
    const rollback = () => {
      finalizeNarration(rec.partial, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
      setRecovery(rec);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    const continuePrompt = `${rec.narratorPrompt}

[Partial narration already shown to the player]
${rec.partial}

The narration above was interrupted and cut off before it finished. Continue it seamlessly from exactly where it stops — do not repeat or restate any of it, do not open a new scene. Write only the continuation, carrying the same passage to a natural close.`;
    const onDelta = (chunk) => {
      acc += chunk;
      setEntries((prev) => {
        if (!prev[narrationIndex] || prev[narrationIndex].type !== "narration") return prev;
        const next = prev.slice();
        next[narrationIndex] = { ...next[narrationIndex], text: acc };
        return next;
      });
    };
    setEntries([...rec.baseEntries, { type: "narration", text: rec.partial, streaming: true }]);
    try {
      await streamAPI(rec.narratorSys, [{ role: "user", content: continuePrompt }], settings.engineNarrator, 700, 0.8, controller.signal, onDelta);
      if (controller.signal.aborted) return;
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return;
      setError(formatError(e));
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
      setRecovery({ ...rec, partial: acc });
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  /** @returns {Promise<void>} */
  const submit = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!metaMode && ended) return;
    skipReveal();
    setRecovery(null);
    if (!metaMode) await ensureAmbienceEngine();
    const previousInput = input;
    const previousInputHistory = inputHistory;
    const previousInputHistoryIndex = inputHistoryIndex;
    setInput("");
    setInputHistory((h) => h[h.length - 1] === text ? h : [...h, text]);
    setInputHistoryIndex(-1);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (metaMode) {
      const previousMeta = metaMessages;
      const newMeta = [
        ...metaMessages,
        { role: "user", text, fullyRevealed: true }
      ];
      setMetaMessages(newMeta);
      setLoadingPhrase(pickPhrase(META_LOADING_PHRASES));
      setLoading(true);
      setError(null);
      const controller2 = new AbortController;
      const rollback2 = () => {
        setMetaMessages(previousMeta);
        setInput(previousInput);
        setInputHistory(previousInputHistory);
        setInputHistoryIndex(previousInputHistoryIndex);
      };
      abortRef.current = { controller: controller2, rollback: rollback2, startedAt: Date.now() };
      try {
        const sys = buildMetaSystem(premise, language);
        const chronicleParts = [];
        for (const h of history) {
          if (h.role === "user") {
            const m = h.content.match(/\[Player action\]\s*\n?([\s\S]*)$/);
            const action = m ? m[1].trim() : h.content.trim();
            if (action) chronicleParts.push(`[Player] ${action}`);
            else chronicleParts.push(`[Player] (Begin)`);
          } else {
            const parsed = parseGMResponse(h.content);
            chronicleParts.push(`[GM] ${parsed.narration}`);
          }
        }
        const MAX_PARTS = 60;
        let trimmedNote = "";
        let kept = chronicleParts;
        if (chronicleParts.length > MAX_PARTS) {
          const head = chronicleParts.slice(0, 4);
          const tail = chronicleParts.slice(-(MAX_PARTS - 4));
          kept = [...head, ...tail];
          trimmedNote = `\n\n[Note: middle of chronicle abridged for length — ${chronicleParts.length - kept.length} turns omitted between the opening and the recent passages.]`;
        }
        const { publicBlock: publicBlock2, privateBlock: privateBlock2 } = formatStateForPrompt(gameState);
        const finalState = privateBlock2 ? `${publicBlock2}\n\n${privateBlock2}` : publicBlock2;
        const chronicleText = kept.join("\n\n") + trimmedNote;
        const metaApiMessages = [
          {
            role: "user",
            content: `For your reference, the full chronicle we just played:\n\n${chronicleText}\n\n— end of chronicle —\n\nFinal game state at the close:\n\n${finalState}`
          },
          {
            role: "assistant",
            content: "I have the chronicle in mind. I'm ready to talk about it with you."
          },
          ...newMeta.map((m) => ({ role: m.role, content: m.text }))
        ];
        const reply = await callAPI(sys, metaApiMessages, false, settings.engineNarrator, 3000, 0.8, controller2.signal);
        if (controller2.signal.aborted) return;
        setMetaMessages([
          ...newMeta,
          { role: "assistant", text: reply, fullyRevealed: false }
        ]);
      } catch (e) {
        if (controller2.signal.aborted) return;
        const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
        if (!cancelled) setError(formatError(e));
        rollback2();
      } finally {
        if (abortRef.current?.controller === controller2) {
          setLoading(false);
          abortRef.current = null;
        }
      }
      return;
    }
    const previousEntries = entries;
    const previousHistory = history;
    const newEntries = [...entries, { type: "action", text, fullyRevealed: true }];
    setEntries(newEntries);
    if (tts.ttsRef.current) tts.ttsRef.current.stop();
    const { publicBlock, privateBlock } = formatStateForPrompt(gameState);
    const parts = [];
    if (publicBlock) parts.push(publicBlock);
    parts.push(`[Player action]\n${text}`);
    if (privateBlock) parts.push(privateBlock);
    const playerMessage = parts.join("\n\n");
    const newHistory = [...history, { role: "user", content: playerMessage }];
    const tailStart = newHistory.length - 1;
    let apiHistory = newHistory.map((msg, i) => {
      if (i >= tailStart) return msg;
      return msg.role === "user" ? { ...msg, content: stripHistoricalUser(msg.content) } : { ...msg, content: stripHistoricalAssistant(msg.content) };
    });
    const TRIM_THRESHOLD = 60;
    const KEEP_RECENT = 44;
    const CHAR_CAP = settings.engineGM?.provider === "groq" ? 60000 : 80000;
    const charsOf = (msgs) => msgs.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
    if (apiHistory.length > TRIM_THRESHOLD) {
      const head = apiHistory.slice(0, 2);
      const tail = apiHistory.slice(-KEEP_RECENT);
      apiHistory = [...head, ...tail];
    }
    if (charsOf(apiHistory) > CHAR_CAP) {
      const head = apiHistory.slice(0, 2);
      let tail = apiHistory.slice(2);
      while (tail.length > 4 && charsOf([...head, ...tail]) > CHAR_CAP) {
        tail = tail.slice(2);
      }
      apiHistory = [...head, ...tail];
    }
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[borrowed] apiHistory", {
        msgs: apiHistory.length,
        chars: charsOf(apiHistory),
        estTokens: Math.round(charsOf(apiHistory) / 4)
      });
    }
    setHistory(newHistory);
    setLoadingPhrase(pickPhrase(NARRATION_LOADING_PHRASES));
    setLoading(true);
    setError(null);
    const controller = new AbortController;
    const rollback = () => {
      setEntries(previousEntries);
      setHistory(previousHistory);
      setInput(previousInput);
      setInputHistory(previousInputHistory);
      setInputHistoryIndex(previousInputHistoryIndex);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const gmSys = buildSystem(premise, language, { split: true });
      const firstGmReply = await callAPI(gmSys, apiHistory, true, settings.engineGM, 2600, 0.35, controller.signal, GM_LOGIC_TOOL);
      if (controller.signal.aborted) return;
      let gmReply = firstGmReply;
      let gmParsed = parseGMLogicResponse(gmReply);
      if (gmParsed.malformed) {
        const priorAssistant = (gmReply && gmReply.trim()) ? gmReply : "(empty response)";
        const correctiveHistory = [
          ...apiHistory,
          { role: "assistant", content: priorAssistant },
          { role: "user", content: `Your previous response could not be parsed. Reason: ${gmParsed.diagnostic || "missing required fields"}.

Call the tool \`gm_decide\` again. Required top-level fields: gm_scratchpad (string, keep it brief — under 120 words), narrator_brief (string, non-empty, the compressed brief for the narrator), state (object with: scene, time, inventory, npcs, clues, summary, hidden_state). Optional: ending. Output ONLY the tool call / JSON object — no prose, no markdown fences.` }
        ];
        const retryGmReply = await callAPI(gmSys, correctiveHistory, true, settings.engineGM, 3600, 0.25, controller.signal, GM_LOGIC_TOOL);
        if (controller.signal.aborted) return;
        gmReply = retryGmReply;
        gmParsed = parseGMLogicResponse(gmReply);
      }
      if (gmParsed.malformed) {
        const err = new BorrowedError("The hour stumbles. Try once more.", gmParsed.diagnostic || "GM logic response was malformed.");
        if (gmParsed.raw) err.raw = gmParsed.raw;
        throw err;
      }
      if (ambienceRef.current && gmParsed.ambience !== undefined)
        ambienceRef.current.applyAmbience(gmParsed.ambience);
      const artDirectorPromise = codex.runArtDirectorTurn({
        entryIndexProvider: () => newEntries.length,
        gmParsed,
        signal: controller.signal
      });
      artDirectorPromise.catch(() => {});
      const narratorSys = buildNarratorSystem(premise, language);
      const recentNarration = entries.filter((e) => e.type === "narration").slice(-4).map((e) => e.text).join("\n\n");
      const narratorPrompt = `[State]\n${serializeStatePublic(gmParsed.state)}\n\n[Narrator brief]\n${gmParsed.narrator_brief}\n\n[Recent narration]\n${recentNarration}`;
      if (settings.streamNarration) {
        const narrationIndex = newEntries.length;
        let acc = "";
        setEntries((prev) => {
          const existing = prev[narrationIndex];
          const entry = { type: "narration", text: "", streaming: true };
          if (existing && existing.illustration) entry.illustration = existing.illustration;
          return [...newEntries, entry];
        });
        const onDelta = (chunk) => {
          acc += chunk;
          setEntries((prev) => {
            if (!prev[narrationIndex] || prev[narrationIndex].type !== "narration") return prev;
            const next = prev.slice();
            next[narrationIndex] = { ...next[narrationIndex], text: acc };
            return next;
          });
        };
        let narration;
        try {
          narration = await streamAPI(narratorSys, [{ role: "user", content: narratorPrompt }], settings.engineNarrator, 1200, 0.8, controller.signal, onDelta);
        } catch (e) {
          if (controller.signal.aborted) return;
          if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return;
          if (e && typeof e.partial === "string" && e.partial) {
            finalizeNarration(e.partial, gmParsed, newEntries, newHistory, true);
            setError(formatError(e));
            setRecovery({
              narratorSys, narratorPrompt, gmParsed,
              baseEntries: newEntries, baseHistory: newHistory,
              partial: e.partial
            });
            return;
          }
          throw e;
        }
        if (controller.signal.aborted) return;
        finalizeNarration(narration, gmParsed, newEntries, newHistory, true);
      } else {
        const narration = await callAPI(narratorSys, [{ role: "user", content: narratorPrompt }], false, settings.engineNarrator, 1200, 0.8, controller.signal);
        if (controller.signal.aborted) return;
        finalizeNarration(narration, gmParsed, newEntries, newHistory, false);
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
      if (!cancelled) setError(formatError(e));
      rollback();
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  const cancelRequest = () => {
    const ref = abortRef.current;
    if (!ref) return;
    const { controller, rollback } = ref;
    abortRef.current = null;
    setLoading(false);
    setError(null);
    try { rollback?.(); } catch {}
    if (controller && !controller.signal.aborted) {
      try { controller.abort(); } catch {}
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    const ta = textareaRef.current;
    if (!ta || inputHistory.length === 0) return;
    if (e.key === "ArrowUp" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      e.preventDefault();
      const newIndex = inputHistoryIndex === -1 ? inputHistory.length - 1 : Math.max(0, inputHistoryIndex - 1);
      setInputHistoryIndex(newIndex);
      setInput(inputHistory[newIndex]);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const v = textareaRef.current.value;
          textareaRef.current.setSelectionRange(v.length, v.length);
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
        }
      });
      return;
    }
    if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length && inputHistoryIndex !== -1) {
      e.preventDefault();
      const newIndex = inputHistoryIndex + 1;
      if (newIndex >= inputHistory.length) {
        setInputHistoryIndex(-1);
        setInput("");
      } else {
        setInputHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
      }
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const v = textareaRef.current.value;
          textareaRef.current.setSelectionRange(v.length, v.length);
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
        }
      });
    }
  };

  const onInputChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  const canUndo = () => {
    if (loading || metaMode) return false;
    return history.length >= 4 && entries.length >= 3;
  };

  const undoLastTurn = () => {
    if (!canUndo()) return;
    const newHistory = history.slice(0, -2);
    const newEntries = entries.slice(0, -2);
    let newState = EMPTY_STATE;
    const lastAssistant = [...newHistory].reverse().find((h) => h.role === "assistant");
    if (lastAssistant) {
      const parsed = parseGMResponse(lastAssistant.content);
      if (parsed.state) newState = parsed.state;
    }
    setHistory(newHistory);
    setEntries(newEntries);
    setGameState(newState);
    setEnded(false);
    setError(null);
    setRecovery(null);
    saves.setSaveBanner({ kind: "ok", text: "The last turn is unmade." });
  };

  const enterMetaMode = () => {
    setMetaMode(true);
    setMetaMessages([]);
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.focus();
    }, 50);
  };

  const exitMetaMode = () => {
    setMetaMode(false);
    setMetaMessages([]);
  };

  const restart = () => {
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    setPhase("title");
    setPremise(null);
    setEntries([]);
    setHistory([]);
    setInput("");
    setError(null);
    setRecovery(null);
    setEnded(false);
    setGameState(EMPTY_STATE);
    setShowLedger(false);
    setInputHistory([]);
    setInputHistoryIndex(-1);
    setMetaMode(false);
    setMetaMessages([]);
    if (ambienceRef.current) ambienceRef.current.applyAmbience(null);
    tts.stopTTS();
    tts.resetTTSCursor(0);
    codex.resetCodex();
  };

  const loadSave = async (save) => {
    let found = null;
    if (save.isCustom && save.premise) {
      found = save.premise;
    } else {
      found = PREMISES.find((p) => p.id === save.premiseId) || save.premise || null;
    }
    if (!found) {
      saves.setSaveBanner({ kind: "err", text: "This hour is no longer here." });
      return;
    }
    setPremise(found);
    setEntries((save.entries || []).map((e) => ({ ...e, fullyRevealed: true })));
    setHistory(save.history || []);
    setInput("");
    setError(null);
    setRecovery(null);
    setEnded(!!save.ended);
    setGameState(save.gameState || EMPTY_STATE);
    setLanguage(save.language || DEFAULT_LANGUAGE);
    setShowLedger(false);
    setInputHistory([]);
    setInputHistoryIndex(-1);
    setMetaMessages((save.metaMessages || []).map((m) => ({ ...m, fullyRevealed: true })));
    setMetaMode(!!save.metaMode);
    codex.restoreCodex(save.codex);
    setPhase("playing");
    saves.setShowSaves(false);
    saves.setSaveBanner({ kind: "ok", text: "The hour resumes." });
    await ensureAmbienceEngine();
    if (ambienceRef.current) {
      const { defaultAmbienceForRealm, deriveAmbienceFromSeed } = await import("./ambience/tables.js");
      const bed = (found.realm === "wild" && found.seed)
        ? deriveAmbienceFromSeed(found.seed)
        : defaultAmbienceForRealm(found.realm);
      ambienceRef.current.applyAmbience(bed);
    }
    tts.stopTTS();
    tts.resetTTSCursor((save.entries || []).length);
  };

  const saveCurrent = () => saves.saveCurrent({
    premise, entries, ended, gameState, history, metaMessages, metaMode, language,
    codex: { styleBible: codex.styleBible, visualLedger: codex.visualLedger, plateCount: codex.plateCount }
  });

  const exportChronicle = (includeMeta = false) =>
    saves.exportChronicle({ premise, entries, ended, metaMessages }, includeMeta);

  const markEntryRevealed = (index) => {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, fullyRevealed: true } : e));
  };

  const markMetaRevealed = (index) => {
    setMetaMessages((prev) => prev.map((m, i) => i === index ? { ...m, fullyRevealed: true } : m));
  };

  const liveRegionText = (() => {
    if (metaMode) {
      const lastMeta = [...metaMessages].reverse().find((m) => m.role === "assistant" && m.fullyRevealed);
      return lastMeta?.text || "";
    }
    const lastEntry = [...entries].reverse().find((e) => e.type === "narration" && e.fullyRevealed);
    return lastEntry?.text || "";
  })();

  return (
    <div
      className={`borrowed-root borrowed-vignette borrowed-grain min-h-screen relative overflow-hidden${settings.highContrast ? " high-contrast" : ""}`}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveRegionText}</div>
      <div className="relative z-10">
        {phase === "title" ? (
          <TitleScreen
            onChoose={beginAdventure}
            onOpenSaves={saves.openSavesModal}
            onOpenCustom={() => setShowCustom(true)}
            onOpenSettings={() => setShowSettings(true)}
            language={language}
            onChangeLanguage={setLanguage}
            loading={loading}
            error={error}
          />
        ) : (
          <GameScreen
            premise={premise}
            entries={entries}
            skipNonce={skipNonce}
            instantReveal={instantReveal}
            onEntryDone={markEntryRevealed}
            onMetaDone={markMetaRevealed}
            loading={loading}
            loadingPhrase={loadingPhrase}
            error={error}
            ended={ended}
            metaMode={metaMode}
            metaMessages={metaMessages}
            onEnterMeta={enterMetaMode}
            onExitMeta={exitMetaMode}
            onOpenLedger={() => setShowLedger(true)}
            onOpenSettings={() => setShowSettings(true)}
            canUndo={canUndo()}
            onUndo={undoLastTurn}
            input={input}
            onInputChange={onInputChange}
            onKeyDown={onKeyDown}
            onSubmit={submit}
            onSkip={skipReveal}
            onCancel={cancelRequest}
            recovery={recovery}
            onContinueNarration={continueNarration}
            onRestart={restart}
            onSave={saveCurrent}
            onOpenSaves={saves.openSavesModal}
            onExport={exportChronicle}
            saveBanner={saves.saveBanner}
            sessionTokens={sessionTokens}
            scrollRef={scrollRef}
            textareaRef={textareaRef}
            ambienceEnabled={ambienceLevel !== "off" && !ambienceUnavailable}
            ambienceMuted={ambienceMuted}
            onToggleAmbienceMute={() => setAmbienceMuted((m) => !m)}
            ttsEnabled={tts.ttsEnabled}
            ttsMuted={tts.ttsMuted}
            ttsPlayback={tts.ttsPlayback}
            onToggleTtsMute={() => tts.setTtsMuted((m) => !m)}
            onTogglePlayPause={() => tts.togglePlayPause(entries)}
            onPlayEntry={(idx) => tts.playEntry(entries, idx)}
          />
        )}
        {saves.showSaves && (
          <SavesModal
            saves={saves.saveList}
            totalBytes={saves.savesTotalBytes}
            cap={SAVE_CAP}
            loading={saves.saveListLoading}
            onClose={() => saves.setShowSaves(false)}
            onLoad={loadSave}
            onDelete={saves.deleteSave}
            inGame={phase === "playing"}
          />
        )}
        {showSettings && (
          <SettingsModal
            settings={settings}
            onChange={updateSetting}
            onClose={() => setShowSettings(false)}
            osReducedMotion={osReducedMotion}
            ambienceLevel={ambienceLevel}
            ambienceUnavailable={ambienceUnavailable}
            ambienceDuringNarrationOnly={ambienceDuringNarrationOnly}
            ambienceBoostWithTTS={ambienceBoostWithTTS}
            ambienceMusicLevel={ambienceMusicLevel}
            onChangeAmbience={setAmbienceLevel}
            onChangeAmbienceDuringNarrationOnly={setAmbienceDuringNarrationOnly}
            onChangeAmbienceBoostWithTTS={setAmbienceBoostWithTTS}
            onChangeAmbienceMusicLevel={setAmbienceMusicLevel}
            ttsEnabled={tts.ttsEnabled}
            ttsProviderId={tts.ttsProviderId}
            ttsProviderReady={tts.ttsProviderReady}
            ttsVoiceId={tts.ttsVoiceId}
            ttsModel={tts.ttsProviderId ? (tts.ttsModelOverrides[tts.ttsProviderId] || null) : null}
            ttsBrowserVoices={tts.ttsBrowserVoices}
            ttsVoxtralVoices={tts.ttsVoxtralVoices}
            ttsVoxtralVoicesError={tts.ttsVoxtralVoicesError}
            ttsRate={tts.ttsRate}
            ttsElevenKey={tts.ttsElevenKey}
            ttsAzureKey={tts.ttsAzureKey}
            ttsAzureRegion={tts.ttsAzureRegion}
            ttsGoogleKey={tts.ttsGoogleKey}
            onChangeTtsEnabled={tts.setTtsEnabled}
            onChangeTtsProvider={tts.setTtsProviderId}
            onChangeTtsVoice={tts.setTtsVoiceId}
            onChangeTtsModel={(m) => {
              if (!tts.ttsProviderId) return;
              tts.setTtsModelOverrides((prev) => {
                const next = { ...prev };
                if (m) next[tts.ttsProviderId] = m; else delete next[tts.ttsProviderId];
                return next;
              });
            }}
            onChangeTtsRate={tts.setTtsRate}
            onChangeTtsElevenKey={async (k) => {
              tts.setTtsElevenKey(k);
              await tts.saveTtsElevenLabsKey(k);
              tts.detectTtsProviderReady();
            }}
            onChangeTtsAzureKey={async (k) => {
              tts.setTtsAzureKey(k);
              await tts.saveTtsAzureKey(k);
              tts.detectTtsProviderReady();
            }}
            onChangeTtsAzureRegion={(r) => {
              tts.setTtsAzureRegion(r);
              tts.saveTtsAzureRegion(r);
            }}
            onChangeTtsGoogleKey={async (k) => {
              tts.setTtsGoogleKey(k);
              await tts.saveTtsGoogleKey(k);
              tts.detectTtsProviderReady();
            }}
          />
        )}
        {showLedger && premise && (
          <LedgerModal
            premise={premise}
            gameState={gameState}
            onClose={() => setShowLedger(false)}
          />
        )}
        {showCustom && (
          <CustomModal
            onClose={() => setShowCustom(false)}
            onBegin={(description) => {
              setShowCustom(false);
              beginAdventure(buildCustomPremise(description));
            }}
            disabled={loading}
          />
        )}
        {saves.exportFallbackText !== null && (
          <ExportFallbackModal
            text={saves.exportFallbackText}
            onClose={() => saves.setExportFallbackText(null)}
          />
        )}
        <PassphraseModal />
      </div>
    </div>
  );
}
