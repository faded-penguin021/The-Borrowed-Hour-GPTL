import React, { useState, useRef, useEffect } from "react";
import { EMPTY_STATE, DEFAULT_SETTINGS, DEFAULT_ENGINE_OPENING, DEFAULT_ENGINE_GM, DEFAULT_ENGINE_NARRATOR, SETTINGS_KEY, SAVE_PREFIX, SAVE_CAP, APPROX_CHARS_PER_TOKEN, estimateSize, formatKB, formatTokens, VALID_ENDINGS } from "./data/constants.js";
import { DEFAULT_LANGUAGE, languageNameFor, LANGUAGES } from "./data/languages.js";
import { PREMISES, buildCustomPremise, NARRATION_LOADING_PHRASES, META_LOADING_PHRASES, OPENING_LOADING_PHRASES, pickPhrase } from "./data/premises.js";
import { PROVIDERS, PROVIDER_META, PROVIDER_ORDER, providerSupportsToolUse, FREE_MODELS_BY_PROVIDER, getProviderKey, getLocalUrl } from "./llm/providers.js";
import { GM_TOOL, GM_LOGIC_TOOL, buildSystem, buildNarratorSystem, buildMetaSystem } from "./llm/tools.js";
import { parseGMResponse, parseGMLogicResponse, isStateEmpty } from "./llm/parse.js";
import { formatStateForPrompt, stripHistoricalUser, stripHistoricalAssistant, serializeStatePublic } from "./llm/prompt.js";
import { formatError, scrubSecrets, extractApiErrorMessage, BorrowedError, httpStatusHint } from "./llm/errors.js";
import {
  ART_DIRECTOR_BOOTSTRAP_TOOL, ART_DIRECTOR_TURN_TOOL,
  buildBootstrapSystem, buildTurnSystem,
  parseBootstrapResponse, parseTurnResponse,
  composeImagePrompt, mergeLedger
} from "./llm/artDirector.js";
import { generateImage } from "./llm/imaging.js";
import { AmbienceEngine } from "./ambience/engine.js";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "./tts/catalogue.js";
import { TTSController } from "./tts/controller.js";
import { getTtsElevenLabsKey, saveTtsElevenLabsKey } from "./tts/elevenLabsKey.js";
import { fetchVoxtralVoices } from "./tts/adapters/voxtral.js";
import { ENC_PREFIX, encryptSecret, decryptSecret } from "./storage/encryption.js";
import { TitleScreen } from "./components/TitleScreen.jsx";
import { GameScreen } from "./components/GameScreen.jsx";
import { SavesModal } from "./components/modals/SavesModal.jsx";
import { SettingsModal } from "./components/modals/SettingsModal.jsx";
import { LedgerModal } from "./components/modals/LedgerModal.jsx";
import { ExportFallbackModal } from "./components/modals/ExportFallbackModal.jsx";
import { CustomModal } from "./components/modals/CustomModal.jsx";
import { ErrorRawDetail } from "./components/ErrorRawDetail.jsx";

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
  const [showSaves, setShowSaves] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveList, setSaveList] = useState([]);
  const [saveListLoading, setSaveListLoading] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);
  const [exportFallbackText, setExportFallbackText] = useState(null);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsLoadedRef = useRef(false);
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 });
  const sessionTokensRef = useRef({ input: 0, output: 0 });
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(SETTINGS_KEY);
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          // Deep-merge the codex block so newly-added defaults survive
          // alongside the user's saved choices.
          merged.codex = {
            ...DEFAULT_SETTINGS.codex,
            ...(parsed.codex || {}),
            providerConfig: {
              ...DEFAULT_SETTINGS.codex.providerConfig,
              ...((parsed.codex && parsed.codex.providerConfig) || {})
            }
          };
          for (const role of ["engineOpening", "engineGM", "engineNarrator"]) {
            const eng = merged[role];
            if (eng?.provider === "gemini" && (eng.model === "gemini-3.1-flash-lite" || eng.model === "gemini-flash-lite-latest"))
              merged[role] = { ...eng, model: "gemma-4-31b-it" };
          }
          if (merged.engineStack && merged.engineStack !== "free" && !providerSupportsToolUse(merged.engineStack)) {
            merged.engineStack = "free";
            if (!merged.freeModelSelection) {
              const preset = FREE_MODELS_BY_PROVIDER.free;
              const prov = preset.provider || "mistral";
              merged.engineOpening  = { provider: prov, model: preset.opener };
              merged.engineGM       = { provider: prov, model: preset.gm };
              merged.engineNarrator = { provider: prov, model: preset.narrator };
            }
          }
          if (merged.engineOpening?.provider && !providerSupportsToolUse(merged.engineOpening.provider))
            merged.engineOpening = DEFAULT_ENGINE_OPENING;
          if (merged.engineGM?.provider && !providerSupportsToolUse(merged.engineGM.provider))
            merged.engineGM = DEFAULT_ENGINE_GM;
          setSettings(merged);
        }
      } catch {} finally {
        settingsLoadedRef.current = true;
      }
    })();
  }, []);
  useEffect(() => {
    if (!settingsLoadedRef.current)
      return;
    (async () => {
      try {
        await window.storage.set(SETTINGS_KEY, JSON.stringify(settings));
      } catch {}
    })();
  }, [settings]);
  const updateSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  // ── Prestige Codex (illustration plates) ──────────────────────────
  // styleBible and visualLedger are seeded by the Art Director on the first
  // turn and updated incrementally. They are persisted with saves so a
  // reloaded chronicle keeps a consistent visual identity. plateCount tracks
  // how many illustrations have been produced this session vs. maxPerSession.
  const [styleBible, setStyleBible] = useState(null);
  const [visualLedger, setVisualLedger] = useState([]);
  const [plateCount, setPlateCount] = useState(0);
  const styleBibleRef = useRef(null);
  const visualLedgerRef = useRef([]);
  const plateCountRef = useRef(0);
  useEffect(() => { styleBibleRef.current = styleBible; }, [styleBible]);
  useEffect(() => { visualLedgerRef.current = visualLedger; }, [visualLedger]);
  useEffect(() => { plateCountRef.current = plateCount; }, [plateCount]);

  const setEntryIllustration = (index, patch) => {
    setEntries((prev) => {
      const e = prev[index];
      if (!e) return prev;
      const next = prev.slice();
      next[index] = { ...e, illustration: { ...(e.illustration || {}), ...patch } };
      return next;
    });
  };
  const [osReducedMotion, setOsReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia)
      return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia)
      return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setOsReducedMotion(e.matches);
    if (mq.addEventListener)
      mq.addEventListener("change", handler);
    else if (mq.addListener)
      mq.addListener(handler);
    return () => {
      if (mq.removeEventListener)
        mq.removeEventListener("change", handler);
      else if (mq.removeListener)
        mq.removeListener(handler);
    };
  }, []);
  const instantReveal = settings.disableTypewriter || osReducedMotion;
  const [ambienceLevel, setAmbienceLevel] = useState("off");
  const [ambienceMuted, setAmbienceMuted] = useState(false);
  const [ambienceUnavailable, setAmbienceUnavailable] = useState(false);
  const [ambienceDuringNarrationOnly, setAmbienceDuringNarrationOnly] = useState(false);
  const [ambienceBoostWithTTS, setAmbienceBoostWithTTS] = useState(false);
  const [ambienceMusicLevel, setAmbienceMusicLevel] = useState("full");
  const ambienceLoadedRef = useRef(false);
  const ambienceRef = useRef(null);
  // Bumped whenever the lazily-built AmbienceEngine is constructed, so
  // coupling effects (speech gate, TTS bridge, boost) re-attach to it.
  const [ambienceEngineNonce, setAmbienceEngineNonce] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("borrowed:ambience:v1");
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          if (parsed && typeof parsed === "object") {
            if (parsed.level === "subtle" || parsed.level === "present" || parsed.level === "off")
              setAmbienceLevel(parsed.level);
            if (typeof parsed.muted === "boolean")
              setAmbienceMuted(parsed.muted);
            if (typeof parsed.duringNarrationOnly === "boolean")
              setAmbienceDuringNarrationOnly(parsed.duringNarrationOnly);
            if (typeof parsed.boostWithTTS === "boolean")
              setAmbienceBoostWithTTS(parsed.boostWithTTS);
            if (parsed.musicLevel === "off" || parsed.musicLevel === "sparse" || parsed.musicLevel === "full")
              setAmbienceMusicLevel(parsed.musicLevel);
          }
        }
      } catch {} finally {
        ambienceLoadedRef.current = true;
      }
    })();
  }, []);
  useEffect(() => {
    if (!ambienceLoadedRef.current) return;
    (async () => {
      try {
        await window.storage.set("borrowed:ambience:v1", JSON.stringify({
          level: ambienceLevel,
          muted: ambienceMuted,
          duringNarrationOnly: ambienceDuringNarrationOnly,
          boostWithTTS: ambienceBoostWithTTS,
          musicLevel: ambienceMusicLevel
        }));
      } catch {}
    })();
  }, [ambienceLevel, ambienceMuted, ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceMusicLevel]);
  const ensureAmbienceEngine = () => {
    if (ambienceLevel === "off") return null;
    if (ambienceUnavailable) return null;
    if (!ambienceRef.current) {
      try {
        ambienceRef.current = new AmbienceEngine();
        setAmbienceEngineNonce((n) => n + 1);
      } catch (e) {
        setAmbienceUnavailable(true);
        if (typeof console !== "undefined" && console.warn)
          console.warn("[borrowed] Ambience unavailable:", e);
        return null;
      }
    }
    const eng = ambienceRef.current;
    if (eng.intensity !== ambienceLevel) eng.setIntensity(ambienceLevel);
    if (eng.muted !== ambienceMuted) eng.mute(ambienceMuted);
    if (eng.musicLevel !== ambienceMusicLevel) eng.setMusicLevel(ambienceMusicLevel);
    return eng;
  };
  useEffect(() => {
    const eng = ambienceRef.current;
    if (!eng) return;
    if (eng.intensity !== ambienceLevel) eng.setIntensity(ambienceLevel);
  }, [ambienceLevel]);
  useEffect(() => {
    const eng = ambienceRef.current;
    if (!eng) return;
    if (eng.muted !== ambienceMuted) eng.mute(ambienceMuted);
  }, [ambienceMuted]);
  useEffect(() => {
    const eng = ambienceRef.current;
    if (!eng) return;
    if (eng.musicLevel !== ambienceMusicLevel) eng.setMusicLevel(ambienceMusicLevel);
  }, [ambienceMusicLevel]);

  // ── TTS (text-to-speech narration) ──────────────────────────────
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);
  const [ttsProviderId, setTtsProviderId] = useState(null); // null → auto-pick on first use
  const [ttsVoiceId, setTtsVoiceId] = useState(null);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsElevenKey, setTtsElevenKey] = useState(""); // plaintext; only used for the inline key field
  const [ttsBrowserVoices, setTtsBrowserVoices] = useState([]);
  const [ttsVoxtralVoices, setTtsVoxtralVoices] = useState([]);
  const [ttsVoxtralVoicesError, setTtsVoxtralVoicesError] = useState(null);
  const [ttsProviderReady, setTtsProviderReady] = useState({ browser: true, puter: true });
  const [ttsPlayback, setTtsPlayback] = useState({ speaking: false, paused: false, loading: false, loadingTurnId: null, activeTurnId: null, lastError: null, lastErrorTurnId: null });
  const ttsLoadedRef = useRef(false);
  const ttsRef = useRef(null);
  // Monotonic cursor: index of the next entry to speak. Reset on chronicle
  // restart (→ 0) and on save load (→ entries.length). Never re-speaks history.
  const ttsNextRef = useRef(0);

  const detectTtsProviderReady = async () => {
    const out = {
      browser: typeof window !== "undefined" && "speechSynthesis" in window,
      puter: true
    };
    for (const id of ["openai", "voxtral"]) {
      const meta = TTS_PROVIDER_META[id];
      try { const k = await getProviderKey(meta.reusesLLMKey); out[id] = !!k; }
      catch { out[id] = false; }
    }
    out.elevenlabs = !!(ttsElevenKey || await getTtsElevenLabsKey());
    setTtsProviderReady(out);
    return out;
  };

  const pickBestReadyProvider = (ready) =>
    TTS_PROVIDER_ORDER.find((id) => ready[id]) || "browser";

  // Load persisted TTS prefs.
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("borrowed:tts:v1");
        if (r?.value) {
          const p = JSON.parse(r.value);
          if (p && typeof p === "object") {
            if (typeof p.enabled === "boolean") setTtsEnabled(p.enabled);
            if (typeof p.muted === "boolean") setTtsMuted(p.muted);
            if (typeof p.providerId === "string" && TTS_PROVIDER_META[p.providerId]) setTtsProviderId(p.providerId);
            if (typeof p.voiceId === "string") setTtsVoiceId(p.voiceId);
            if (typeof p.rate === "number") setTtsRate(p.rate);
          }
        }
      } catch {} finally {
        ttsLoadedRef.current = true;
      }
    })();
    detectTtsProviderReady();
    // Load ElevenLabs key (plaintext if not encrypted, or empty)
    (async () => {
      const k = await getTtsElevenLabsKey().catch(() => null);
      if (k) setTtsElevenKey(k);
    })();
  }, []);

  // Persist prefs whenever they change.
  useEffect(() => {
    if (!ttsLoadedRef.current) return;
    (async () => {
      try {
        await window.storage.set("borrowed:tts:v1", JSON.stringify({
          enabled: ttsEnabled, muted: ttsMuted,
          providerId: ttsProviderId, voiceId: ttsVoiceId, rate: ttsRate
        }));
      } catch {}
    })();
  }, [ttsEnabled, ttsMuted, ttsProviderId, ttsVoiceId, ttsRate]);

  const ensureTTSController = () => {
    if (!ttsRef.current) {
      const ctrl = new TTSController();
      ctrl.onStateChange(() => setTtsPlayback({
        speaking: ctrl.isSpeaking(),
        paused: ctrl.isPaused(),
        loading: ctrl.isLoading(),
        loadingTurnId: ctrl.loadingFor(),
        activeTurnId: ctrl.activeTurnId,
        lastError: ctrl.lastError,
        lastErrorTurnId: ctrl.lastErrorTurnId
      }));
      ttsRef.current = ctrl;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const reload = () => setTtsBrowserVoices(window.speechSynthesis.getVoices().slice());
        reload();
        window.speechSynthesis.onvoiceschanged = reload;
      }
    }
    return ttsRef.current;
  };

  // Per-entry play handler (button shown beneath each fully-revealed narration).
  // Behavior: if this entry is the active one → toggle pause/resume; otherwise
  // stop whatever is playing and synthesize this entry from scratch.
  const playEntry = async (idx) => {
    const ctrl = ensureTTSController();
    const e = entries[idx];
    if (!e || e.type !== "narration" || !e.fullyRevealed) return;
    const active = ctrl.activeTurnId === idx && ctrl.activeHandle;
    if (active) {
      if (ctrl.isPaused()) ctrl.resume();
      else ctrl.pause();
      return;
    }
    if (typeof e.text !== "string" || !e.text.trim()) return;
    // Push enabled/muted into the controller directly — React state updates
    // won't reach the controller in time for the speak() call in this tick.
    if (!ttsEnabled) setTtsEnabled(true);
    if (ttsMuted) setTtsMuted(false);
    ctrl.setEnabled(true);
    ctrl.setMuted(false);
    // Ensure a provider is chosen and the controller has its key. Without
    // this, a first-time click (TTS never enabled) leaves the controller on
    // its default with no adapter configured and speak() silently no-ops.
    let providerId = ttsProviderId;
    if (!providerId) {
      const ready = await detectTtsProviderReady();
      providerId = pickBestReadyProvider(ready);
      setTtsProviderId(providerId);
    }
    const meta = TTS_PROVIDER_META[providerId];
    if (meta) {
      let key = null;
      if (meta.reusesLLMKey) { try { key = await getProviderKey(meta.reusesLLMKey); } catch {} }
      else if (providerId === "elevenlabs") key = ttsElevenKey || (await getTtsElevenLabsKey().catch(() => null));
      ctrl.setProvider(providerId, { voiceId: ttsVoiceId, key });
    }
    ctrl.speak(e.text, { turnId: idx });
  };

  // Play/pause/replay handler for the HUD button.
  const togglePlayPause = () => {
    const ctrl = ensureTTSController();
    if (ctrl.isPaused()) { ctrl.resume(); return; }
    if (ctrl.isSpeaking()) { ctrl.pause(); return; }
    // Nothing active — replay the last fully-revealed narration entry.
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e?.type === "narration" && e.fullyRevealed && typeof e.text === "string" && e.text.trim()) {
        ctrl.speak(e.text, { turnId: i });
        return;
      }
    }
  };

  // Sync enabled/muted/rate/voice to controller.
  useEffect(() => { ttsRef.current?.setEnabled(ttsEnabled); }, [ttsEnabled]);
  useEffect(() => { ttsRef.current?.setMuted(ttsMuted); }, [ttsMuted]);
  useEffect(() => { ttsRef.current?.setRate(ttsRate); }, [ttsRate]);
  useEffect(() => { ttsRef.current?.setVoice(ttsVoiceId); }, [ttsVoiceId]);

  // When provider/key changes, resolve the key and update the controller.
  useEffect(() => {
    if (!ttsProviderId) return;
    (async () => {
      const ctrl = ensureTTSController();
      const meta = TTS_PROVIDER_META[ttsProviderId];
      if (!meta) return;
      let key = null;
      if (meta.reusesLLMKey) { try { key = await getProviderKey(meta.reusesLLMKey); } catch {} }
      else if (ttsProviderId === "elevenlabs") key = ttsElevenKey || (await getTtsElevenLabsKey().catch(() => null));
      ctrl.setProvider(ttsProviderId, { voiceId: ttsVoiceId, key });
    })();
  }, [ttsProviderId, ttsVoiceId, ttsElevenKey]);

  // Re-check provider readiness when settings panel opens.
  useEffect(() => { if (showSettings) detectTtsProviderReady(); }, [showSettings]);

  // Fetch Voxtral's voice catalogue from the API. The hosted endpoint's voice
  // IDs differ from the open-weight model's preset names, so static lists go
  // stale fast — pull the live list whenever the user opens settings (or first
  // selects Voxtral) and a Mistral key is available.
  useEffect(() => {
    if (ttsProviderId !== "voxtral") return;
    if (!showSettings && ttsVoxtralVoices.length > 0) return;
    let cancelled = false;
    (async () => {
      let key = null;
      try { key = await getProviderKey("mistral"); } catch {}
      if (!key) return;
      try {
        const voices = await fetchVoxtralVoices(key);
        if (!cancelled) { setTtsVoxtralVoices(voices); setTtsVoxtralVoicesError(null); }
      } catch (e) {
        if (!cancelled) setTtsVoxtralVoicesError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [ttsProviderId, showSettings]);

  // Ambience↔TTS coupling — gate: ambience only during narration.
  useEffect(() => {
    ambienceRef.current?.setSpeechGate(ambienceDuringNarrationOnly && ttsEnabled);
  }, [ambienceDuringNarrationOnly, ttsEnabled, ambienceEngineNonce]);
  // Ambience↔TTS coupling — boost: lift ambience one notch while TTS is on.
  useEffect(() => {
    ambienceRef.current?.setBoost(ambienceBoostWithTTS && ttsEnabled);
  }, [ambienceBoostWithTTS, ttsEnabled, ambienceEngineNonce]);

  // Bridge: subscribe ambience engine to TTS controller speak events.
  useEffect(() => {
    const ctrl = ttsRef.current;
    const eng = ambienceRef.current;
    if (!ctrl || !eng) return;
    const u1 = ctrl.onSpeakStart(() => eng.notifySpeechStart());
    const u2 = ctrl.onSpeakEnd(()   => eng.notifySpeechEnd());
    return () => { u1(); u2(); };
  }, [ttsEnabled, ambienceLevel, ambienceEngineNonce]);

  // Walk entries. When a narration entry is fully revealed, speak it.
  // ttsNextRef advances monotonically — toggling TTS on doesn't replay history.
  useEffect(() => {
    if (!ttsEnabled || ttsMuted) {
      ttsNextRef.current = entries.length;
      return;
    }
    // Auto-pick a provider if not yet chosen.
    if (!ttsProviderId) {
      detectTtsProviderReady().then((ready) => setTtsProviderId(pickBestReadyProvider(ready)));
      return;
    }
    const ctrl = ensureTTSController();
    while (ttsNextRef.current < entries.length) {
      const i = ttsNextRef.current;
      const e = entries[i];
      if (!e) break;
      if (e.type !== "narration") { ttsNextRef.current++; continue; }
      if (!e.fullyRevealed) break;
      if (typeof e.text === "string" && e.text.trim()) ctrl.speak(e.text, { turnId: i });
      ttsNextRef.current++;
      break; // one utterance per render
    }
  }, [entries, ttsEnabled, ttsMuted, ttsProviderId]);

  const [savesTotalBytes, setSavesTotalBytes] = useState(0);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  useEffect(() => {
    // The visualViewport "scroll" event fires constantly while a mobile user
    // scrolls (URL-bar reveal/hide). Without throttling and without a
    // change-check, we re-set --app-vh on every event, thrashing layout on
    // long-session screens. rAF-batch + no-op-on-same-height fixes that.
    let lastH = -1;
    let rafId = 0;
    const apply = () => {
      rafId = 0;
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (h === lastH) return;
      lastH = h;
      document.documentElement.style.setProperty("--app-vh", `${h}px`);
    };
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(apply);
    };
    apply();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);
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
    // When a mobile browser suspends a backgrounded tab mid-request, the
    // underlying fetch/stream can land in a zombie state — UI shows
    // loading=true, but reader.read() never resolves. The stream watchdog
    // catches this after 60s, but if the request itself has been in flight
    // far longer than any realistic round-trip when the tab returns, abort
    // immediately so the player isn't staring at a frozen page.
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
    if (!saveBanner)
      return;
    const t = setTimeout(() => setSaveBanner(null), 2400);
    return () => clearTimeout(t);
  }, [saveBanner]);
  const skipReveal = () => setSkipNonce((n) => n + 1);
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
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
      if (signal && signal.aborted) {
        throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
      }
      let request;
      try {
        const apiKey = await getProviderKey(providerId);
        request = provider.buildRequest({
          sys,
          msgs,
          useTool,
          model,
          maxTokens,
          temperature: temp,
          tool,
          apiKey
        });
      } catch (e) {
        if (e instanceof BorrowedError)
          throw e;
        throw new BorrowedError("The hour falters.", `Could not build the ${meta.name} request${e?.message ? ` (${e.message})` : ""}.`);
      }
      try {
        res = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: signal || undefined
        });
        if (res.ok) {
          lastErr = null;
          break;
        }
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
        if (e instanceof BorrowedError)
          throw e;
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
      try {
        provider.logUsage(data, model);
      } catch {}
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
      if (fallback)
        onDelta(fallback);
      return fallback;
    }
    let temp = temperature;
    const RETRYABLE = provider.retryable;
    const MAX_RETRIES = 2;
    let lastErr = null;
    for (let attempt = 0;attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0)
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
      if (signal && signal.aborted) {
        throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
      }
      let request;
      try {
        const apiKey = await getProviderKey(providerId);
        request = provider.buildStreamRequest({ sys, msgs, model, maxTokens, temperature: temp, apiKey });
      } catch (e) {
        if (e instanceof BorrowedError)
          throw e;
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
        try {
          bodySnippet = scrubSecrets((await res.text()).slice(0, 500));
        } catch {}
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
      // Stall watchdog: if no chunk arrives for STALL_MS, cancel the reader so
      // the UI can recover. Without this, a mobile browser that suspends a
      // backgrounded tab can leave reader.read() hanging forever when the
      // underlying connection has died, freezing every action button.
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
        if (!rawEvent.trim())
          return;
        const parsed = provider.parseStreamEvent(rawEvent);
        if (!parsed)
          return;
        if (parsed.usage)
          usage = Object.assign(usage || {}, parsed.usage);
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
          if (done)
            break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
          let idx;
          while ((idx = buffer.indexOf(`

`)) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            handleEvent(rawEvent);
          }
        }
        handleEvent(buffer);
      } catch (e) {
        try {
          reader.cancel();
        } catch {}
        if (stalled) {
          const err = new BorrowedError("The hour falters.", `The ${meta.name} narration stream went silent for ${Math.round(STALL_MS/1000)}s — likely the connection was dropped while the tab was in the background. Try again.`);
          if (full)
            err.partial = full;
          throw err;
        }
        if (e && e.name === "AbortError" || signal && signal.aborted) {
          throw new BorrowedError("The hour is set down.", "Request cancelled by the player.");
        }
        const err = e instanceof BorrowedError ? e : new BorrowedError("The hour falters.", `The ${meta.name} narration stream broke${e?.message ? ` (${e.message})` : ""}.`);
        if (full)
          err.partial = full;
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
  // Bootstrap the Style Bible + initial Visual Ledger in parallel with the
  // Opening Engine. Failure is silent — the chronicle continues without
  // illustrations rather than blocking the opening.
  const runArtDirectorBootstrap = async (chosen, signal) => {
    const codex = settings.codex || {};
    if (codex.mode === "off") return;
    const engine = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };
    try {
      const sys = buildBootstrapSystem(chosen, language);
      const msgs = [{ role: "user", content: "Seed the codex for this chronicle." }];
      const raw = await callAPI(sys, msgs, true, engine, 1400, 0.4, signal, ART_DIRECTOR_BOOTSTRAP_TOOL);
      if (signal?.aborted) return;
      const parsed = parseBootstrapResponse(raw);
      if (parsed.malformed) return;
      setStyleBible(parsed.style_bible);
      setVisualLedger(parsed.visual_ledger || []);
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Art Director bootstrap failed:", e?.detail || e?.message || e);
    }
  };

  // Run the per-turn Art Director and, if warranted, kick off image
  // generation. Attaches the resulting illustration to the entry at
  // `entryIndex`. All errors become a "Missing Plate" — never break the turn.
  const runArtDirectorTurn = async ({ entryIndexProvider, gmParsed, signal }) => {
    const codex = settings.codex || {};
    if (codex.mode === "off") return;
    const cap = codex.maxPerSession ?? 12;
    if (plateCountRef.current >= cap && codex.mode !== "always") return;
    const sb = styleBibleRef.current;
    if (!sb) return; // bootstrap hasn't landed yet — skip silently this turn

    const engine = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };
    let ad;
    try {
      const sys = buildTurnSystem(premise, sb, visualLedgerRef.current, language);
      const userPrompt = `[Scene]\n${gmParsed.state?.scene || ""}\n\n[Narrator brief]\n${gmParsed.narrator_brief || ""}\n\n[Named NPCs present this turn]\n${(gmParsed.state?.npcs || []).map((n) => `- ${n.name}: ${n.note}`).join("\n") || "(none)"}\n\nDecide if this turn warrants a plate. Be ruthless; the default is no.`;
      const raw = await callAPI(sys, [{ role: "user", content: userPrompt }], true, engine, 900, 0.4, signal, ART_DIRECTOR_TURN_TOOL);
      if (signal?.aborted) return;
      const parsed = parseTurnResponse(raw);
      if (parsed.malformed) return;
      if (parsed.ledger_updates?.length) {
        const merged = mergeLedger(visualLedgerRef.current, parsed.ledger_updates);
        visualLedgerRef.current = merged;
        setVisualLedger(merged);
      }
      ad = parsed;
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Art Director turn failed:", e?.detail || e?.message || e);
      return;
    }

    // In "key_moments" mode some smaller models say warrants_illustration=true
    // but write a negative milestone_reason ("no significant event") or omit
    // the scene clause. Treat those as a no. In "always" mode, the player has
    // asked for a plate every turn, so we override the AD's gate entirely and
    // fall back to the GM's scene description if no scene_clause was written.
    const reason = (ad.milestone_reason || "").trim();
    const NEG = /\b(no|not|none|nothing|minor|routine|absent|n\/a|skip)\b/i;
    let sceneClause = (ad.scene_clause || "").trim();
    let wants;
    if (codex.mode === "always") {
      if (!sceneClause || sceneClause.length < 12) {
        sceneClause = (gmParsed.state?.scene || gmParsed.narrator_brief || "").trim();
      }
      wants = sceneClause.length >= 12;
    } else {
      const looksNegative = !reason || reason.length < 6 || NEG.test(reason);
      wants = ad.warrants_illustration && !looksNegative && sceneClause.length >= 12;
    }
    if (!wants) return;

    const idx = entryIndexProvider();
    if (idx == null || idx < 0) return;
    setEntryIllustration(idx, { status: "pending", milestoneReason: ad.milestone_reason || "" });
    plateCountRef.current = plateCountRef.current + 1;
    setPlateCount(plateCountRef.current);

    const { prompt, negatives } = composeImagePrompt({
      styleBible: sb,
      visualLedger: visualLedgerRef.current,
      subjectIds: ad.subject_ids,
      sceneClause,
      extraNegatives: ad.extra_negatives
    });

    try {
      const providerId = codex.provider || "pollinations";
      const providerCfg = (codex.providerConfig && codex.providerConfig[providerId]) || {};
      const img = await generateImage({
        providerId, providerConfig: providerCfg, prompt, negatives,
        signal, timeoutMs: codex.timeoutMs || 20000
      });
      if (signal?.aborted) return;
      setEntryIllustration(idx, { status: "ready", url: img.url, prompt, provider: img.provider });
    } catch (e) {
      if (signal?.aborted) return;
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Image generation failed:", e?.detail || e?.message || e);
      setEntryIllustration(idx, { status: "failed" });
    }
  };

  const beginAdventure = async (chosen) => {
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    setPremise(chosen);
    setPhase("playing");
    setGameState(EMPTY_STATE);
    // Reset codex per chronicle. The bootstrap call below re-seeds them.
    setStyleBible(null); styleBibleRef.current = null;
    setVisualLedger([]); visualLedgerRef.current = [];
    setPlateCount(0); plateCountRef.current = 0;
    setLoadingPhrase(pickPhrase(OPENING_LOADING_PHRASES));
    setLoading(true);
    setError(null);
    setRecovery(null);
    ensureAmbienceEngine();
    const controller = new AbortController;
    const rollback = () => {
      setPhase("title");
      setPremise(null);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const sys = buildSystem(chosen, language);
      const msgs = [{ role: "user", content: "Begin." }];
      // Kick the Art Director bootstrap in parallel — it must not block the
      // opening narration, but its result is needed for any later plates.
      const bootstrapPromise = runArtDirectorBootstrap(chosen, controller.signal);
      const firstRaw = await callAPI(sys, msgs, true, settings.engineOpening, 4500, 0.7, controller.signal);
      // Don't await bootstrap here — we never want it to delay the opening.
      bootstrapPromise.catch(() => {});
      if (controller.signal.aborted)
        return;
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
        if (controller.signal.aborted)
          return;
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
      if (parsed.state)
        setGameState(parsed.state);
      if (parsed.ending)
        setEnded(true);
      if (ambienceRef.current && parsed.ambience !== undefined)
        ambienceRef.current.applyAmbience(parsed.ambience);
    } catch (e) {
      if (controller.signal.aborted)
        return;
      const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
      if (!cancelled) {
        setError(formatError(e));
      }
      rollback();
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };
  const finalizeNarration = (narration, gmParsed, baseEntries, baseHistory, fullyRevealed) => {
    const assistantPayload = JSON.stringify({ gm_scratchpad: "", narration, state: gmParsed.state, ending: gmParsed.ending });
    setHistory([...baseHistory, { role: "assistant", content: assistantPayload }]);
    // Preserve any illustration the Art Director may have already attached to
    // this index in parallel — finalizeNarration runs after the narrator
    // returns, which can be after the image has landed.
    setEntries((prev) => {
      const existing = prev[baseEntries.length];
      const entry = { type: "narration", text: narration, fullyRevealed };
      if (existing && existing.illustration) entry.illustration = existing.illustration;
      return [...baseEntries, entry];
    });
    if (gmParsed.state && !(isStateEmpty(gmParsed.state) && !isStateEmpty(gameState))) {
      setGameState(gmParsed.state);
    }
    if (gmParsed.ending)
      setEnded(true);
  };
  const continueNarration = async () => {
    const rec = recovery;
    if (!rec || loading)
      return;
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
        if (!prev[narrationIndex] || prev[narrationIndex].type !== "narration")
          return prev;
        const next = prev.slice();
        next[narrationIndex] = { ...next[narrationIndex], text: acc };
        return next;
      });
    };
    setEntries([...rec.baseEntries, { type: "narration", text: rec.partial, streaming: true }]);
    try {
      await streamAPI(rec.narratorSys, [{ role: "user", content: continuePrompt }], settings.engineNarrator, 700, 0.8, controller.signal, onDelta);
      if (controller.signal.aborted)
        return;
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
    } catch (e) {
      if (controller.signal.aborted)
        return;
      if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.")
        return;
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
  const submit = async () => {
    const text = input.trim();
    if (!text || loading)
      return;
    if (!metaMode && ended)
      return;
    skipReveal();
    setRecovery(null);
    if (!metaMode) ensureAmbienceEngine();
    const previousInput = input;
    const previousInputHistory = inputHistory;
    const previousInputHistoryIndex = inputHistoryIndex;
    setInput("");
    setInputHistory((h) => h[h.length - 1] === text ? h : [...h, text]);
    setInputHistoryIndex(-1);
    if (textareaRef.current)
      textareaRef.current.style.height = "auto";
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
            if (action)
              chronicleParts.push(`[Player] ${action}`);
            else
              chronicleParts.push(`[Player] (Begin)`);
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
          trimmedNote = `

[Note: middle of chronicle abridged for length — ${chronicleParts.length - kept.length} turns omitted between the opening and the recent passages.]`;
        }
        const { publicBlock: publicBlock2, privateBlock: privateBlock2 } = formatStateForPrompt(gameState);
        const finalState = privateBlock2 ? `${publicBlock2}

${privateBlock2}` : publicBlock2;
        const chronicleText = kept.join(`

`) + trimmedNote;
        const metaApiMessages = [
          {
            role: "user",
            content: `For your reference, the full chronicle we just played:

${chronicleText}

— end of chronicle —

Final game state at the close:

${finalState}`
          },
          {
            role: "assistant",
            content: "I have the chronicle in mind. I'm ready to talk about it with you."
          },
          ...newMeta.map((m) => ({ role: m.role, content: m.text }))
        ];
        const reply = await callAPI(sys, metaApiMessages, false, settings.engineNarrator, 3000, 0.8, controller2.signal);
        if (controller2.signal.aborted)
          return;
        setMetaMessages([
          ...newMeta,
          { role: "assistant", text: reply, fullyRevealed: false }
        ]);
      } catch (e) {
        if (controller2.signal.aborted)
          return;
        const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
        if (!cancelled) {
          setError(formatError(e));
        }
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
    // Cut off any in-flight narration; the player has moved on.
    if (ttsRef.current) ttsRef.current.stop();
    const { publicBlock, privateBlock } = formatStateForPrompt(gameState);
    const parts = [];
    if (publicBlock)
      parts.push(publicBlock);
    parts.push(`[Player action]
${text}`);
    if (privateBlock)
      parts.push(privateBlock);
    const playerMessage = parts.join(`

`);
    const newHistory = [...history, { role: "user", content: playerMessage }];
    const tailStart = newHistory.length - 1;
    let apiHistory = newHistory.map((msg, i) => {
      if (i >= tailStart)
        return msg;
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
      const gmSys = buildSystem(premise, language);
      const firstGmReply = await callAPI(gmSys, apiHistory, true, settings.engineGM, 2600, 0.35, controller.signal, GM_LOGIC_TOOL);
      if (controller.signal.aborted)
        return;
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
        if (controller.signal.aborted)
          return;
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
      // Kick the Art Director in parallel with the narrator. The narration
      // entry will be inserted at index `newEntries.length` — image arrives
      // asynchronously and attaches itself when ready (or fades as a Missing
      // Plate on failure). Never awaited; never blocks input.
      const artDirectorPromise = runArtDirectorTurn({
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
        // Use functional form + preserve any illustration the Art Director
        // may have already attached at this index in parallel.
        setEntries((prev) => {
          const existing = prev[narrationIndex];
          const entry = { type: "narration", text: "", streaming: true };
          if (existing && existing.illustration) entry.illustration = existing.illustration;
          return [...newEntries, entry];
        });
        const onDelta = (chunk) => {
          acc += chunk;
          setEntries((prev) => {
            if (!prev[narrationIndex] || prev[narrationIndex].type !== "narration")
              return prev;
            const next = prev.slice();
            next[narrationIndex] = { ...next[narrationIndex], text: acc };
            return next;
          });
        };
        let narration;
        try {
          narration = await streamAPI(narratorSys, [{ role: "user", content: narratorPrompt }], settings.engineNarrator, 1200, 0.8, controller.signal, onDelta);
        } catch (e) {
          if (controller.signal.aborted)
            return;
          if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.")
            return;
          if (e && typeof e.partial === "string" && e.partial) {
            finalizeNarration(e.partial, gmParsed, newEntries, newHistory, true);
            setError(formatError(e));
            setRecovery({
              narratorSys,
              narratorPrompt,
              gmParsed,
              baseEntries: newEntries,
              baseHistory: newHistory,
              partial: e.partial
            });
            return;
          }
          throw e;
        }
        if (controller.signal.aborted)
          return;
        finalizeNarration(narration, gmParsed, newEntries, newHistory, true);
      } else {
        const narration = await callAPI(narratorSys, [{ role: "user", content: narratorPrompt }], false, settings.engineNarrator, 1200, 0.8, controller.signal);
        if (controller.signal.aborted)
          return;
        finalizeNarration(narration, gmParsed, newEntries, newHistory, false);
      }
    } catch (e) {
      if (controller.signal.aborted)
        return;
      const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
      if (!cancelled) {
        setError(formatError(e));
      }
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
    if (!ref)
      return;
    const { controller, rollback } = ref;
    abortRef.current = null;
    setLoading(false);
    setError(null);
    try {
      rollback?.();
    } catch {}
    if (controller && !controller.signal.aborted) {
      try {
        controller.abort();
      } catch {}
    }
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    const ta = textareaRef.current;
    if (!ta || inputHistory.length === 0)
      return;
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
    if (loading || metaMode)
      return false;
    return history.length >= 4 && entries.length >= 3;
  };
  const undoLastTurn = () => {
    if (!canUndo())
      return;
    const newHistory = history.slice(0, -2);
    const newEntries = entries.slice(0, -2);
    let newState = EMPTY_STATE;
    const lastAssistant = [...newHistory].reverse().find((h) => h.role === "assistant");
    if (lastAssistant) {
      const parsed = parseGMResponse(lastAssistant.content);
      if (parsed.state)
        newState = parsed.state;
    }
    setHistory(newHistory);
    setEntries(newEntries);
    setGameState(newState);
    setEnded(false);
    setError(null);
    setRecovery(null);
    setSaveBanner({ kind: "ok", text: "The last turn is unmade." });
  };
  const enterMetaMode = () => {
    setMetaMode(true);
    setMetaMessages([]);
    setTimeout(() => {
      if (textareaRef.current)
        textareaRef.current.focus();
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
    if (ttsRef.current) ttsRef.current.stop();
    ttsNextRef.current = 0;
    setStyleBible(null); styleBibleRef.current = null;
    setVisualLedger([]); visualLedgerRef.current = [];
    setPlateCount(0); plateCountRef.current = 0;
  };
  const loadSaveList = async () => {
    setSaveListLoading(true);
    try {
      const result = await window.storage.list(SAVE_PREFIX);
      const keys = result?.keys || [];
      const saves = [];
      let totalBytes = 0;
      for (const key of keys) {
        try {
          const r = await window.storage.get(key);
          if (r?.value) {
            const size = estimateSize(r.value);
            totalBytes += size.bytes;
            const parsed = JSON.parse(r.value);
            saves.push({ key, size, ...parsed });
          }
        } catch {}
      }
      saves.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setSaveList(saves);
      setSavesTotalBytes(totalBytes);
    } catch {
      setSaveList([]);
      setSavesTotalBytes(0);
    } finally {
      setSaveListLoading(false);
    }
  };
  const openSavesModal = async () => {
    setShowSaves(true);
    await loadSaveList();
  };
  const saveCurrent = async () => {
    if (!premise || entries.length === 0)
      return;
    const id = Date.now().toString(36);
    const key = SAVE_PREFIX + id;
    const payload = {
      id,
      premiseId: premise.id,
      premise,
      title: premise.title,
      realm: premise.realm,
      realmLabel: premise.realmLabel,
      isCustom: !!premise.isCustom,
      savedAt: Date.now(),
      turns: entries.filter((e) => e.type === "action").length,
      ended,
      gameState,
      entries: entries.map((e) => {
        // Drop pending/failed illustrations on save (their URLs are blob:
        // refs that won't survive a reload anyway). Keep only ready
        // illustrations whose URL is a data: URL; blob: URLs are session-
        // local and would 404 if we kept them.
        const ill = e.illustration && e.illustration.status === "ready" && typeof e.illustration.url === "string" && e.illustration.url.startsWith("data:")
          ? e.illustration
          : undefined;
        return { ...e, fullyRevealed: true, illustration: ill };
      }),
      history,
      metaMessages: metaMessages.map((m) => ({ ...m, fullyRevealed: true })),
      metaMode,
      language,
      codex: { styleBible, visualLedger, plateCount }
    };
    try {
      const existing = await window.storage.list(SAVE_PREFIX);
      const existingCount = existing?.keys?.length || 0;
      if (existingCount >= SAVE_CAP) {
        setSaveBanner({
          kind: "err",
          text: `${SAVE_CAP} hours already kept — release one to make room.`
        });
        await openSavesModal();
        return;
      }
    } catch {}
    const serialized = JSON.stringify(payload);
    const size = estimateSize(serialized);
    try {
      await window.storage.set(key, serialized);
      setSaveBanner({
        kind: "ok",
        text: `The hour is set aside. (${formatKB(size.kb)} · ${formatTokens(size.tokens)})`
      });
      await loadSaveList();
    } catch (e) {
      const msg = e && e.message || "";
      const looksQuota = /quota|limit|too large|size|5\s*mb/i.test(msg);
      setSaveBanner({
        kind: "err",
        text: looksQuota ? "Could not set the hour aside — the save exceeds the storage limit. Try releasing other hours first." : "Could not set the hour aside."
      });
    }
  };
  const loadSave = async (save) => {
    let found = null;
    if (save.isCustom && save.premise) {
      found = save.premise;
    } else {
      found = PREMISES.find((p) => p.id === save.premiseId) || save.premise || null;
    }
    if (!found) {
      setSaveBanner({ kind: "err", text: "This hour is no longer here." });
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
    const savedCodex = save.codex || {};
    setStyleBible(savedCodex.styleBible || null);
    styleBibleRef.current = savedCodex.styleBible || null;
    setVisualLedger(savedCodex.visualLedger || []);
    visualLedgerRef.current = savedCodex.visualLedger || [];
    setPlateCount(savedCodex.plateCount || 0);
    plateCountRef.current = savedCodex.plateCount || 0;
    setPhase("playing");
    setShowSaves(false);
    setSaveBanner({ kind: "ok", text: "The hour resumes." });
    // Don't narrate loaded history aloud — advance the TTS cursor past it.
    if (ttsRef.current) ttsRef.current.stop();
    ttsNextRef.current = (save.entries || []).length;
  };
  const deleteSave = async (key, e) => {
    e.stopPropagation();
    try {
      await window.storage.delete(key);
      await loadSaveList();
    } catch {}
  };
  const exportChronicle = async (includeMeta = false) => {
    if (!premise || entries.length === 0)
      return;
    const lines = [];
    lines.push(`# ${premise.title}`);
    lines.push(`*${premise.realmLabel} · The Borrowed Hour*`);
    lines.push("");
    if (premise.teaser) {
      lines.push(`> ${premise.teaser}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
    for (const entry of entries) {
      if (entry.type === "narration") {
        lines.push(entry.text.trim());
        lines.push("");
      } else if (entry.type === "action") {
        const safe = entry.text.trim().replace(/\n/g, `
> `);
        lines.push(`> › ${safe}`);
        lines.push("");
      }
    }
    if (ended) {
      lines.push("---");
      lines.push("");
      lines.push("*❦ The hour is spent. ❦*");
      lines.push("");
    }
    const metaIncluded = includeMeta && metaMessages.length > 0;
    if (metaIncluded) {
      lines.push("---");
      lines.push("");
      lines.push("## Director's commentary");
      lines.push("");
      lines.push("*Conversation with the author of the hour, after its close.*");
      lines.push("");
      for (const m of metaMessages) {
        if (m.role === "user") {
          const safe = m.text.trim().replace(/\n/g, `
> `);
          lines.push(`> **You:** ${safe}`);
          lines.push("");
        } else {
          lines.push(`**The author:** ${m.text.trim()}`);
          lines.push("");
        }
      }
    }
    const text = lines.join(`
`);
    const okBannerText = metaIncluded ? "A copy of the chronicle and the commentary is on the clipboard." : "A copy of the chronicle is on the clipboard.";
    const tryClipboardAPI = async () => {
      if (!navigator.clipboard?.writeText)
        return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    };
    const tryLegacyCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.width = "1px";
        ta.style.height = "1px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };
    if (await tryClipboardAPI()) {
      setSaveBanner({ kind: "ok", text: okBannerText });
      return;
    }
    if (tryLegacyCopy()) {
      setSaveBanner({ kind: "ok", text: okBannerText });
      return;
    }
    setExportFallbackText(text);
  };
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
  return /* @__PURE__ */ React.createElement("div", {
    className: `borrowed-root borrowed-vignette borrowed-grain min-h-screen relative overflow-hidden${settings.highContrast ? " high-contrast" : ""}`
  }, /* @__PURE__ */ React.createElement("div", {
    className: "sr-only",
    "aria-live": "polite",
    "aria-atomic": "true"
  }, liveRegionText), /* @__PURE__ */ React.createElement("div", {
    className: "relative z-10"
  }, phase === "title" ? /* @__PURE__ */ React.createElement(TitleScreen, {
    onChoose: beginAdventure,
    onOpenSaves: openSavesModal,
    onOpenCustom: () => setShowCustom(true),
    onOpenSettings: () => setShowSettings(true),
    language,
    onChangeLanguage: setLanguage,
    loading,
    error
  }) : /* @__PURE__ */ React.createElement(GameScreen, {
    premise,
    entries,
    skipNonce,
    instantReveal,
    onEntryDone: markEntryRevealed,
    onMetaDone: markMetaRevealed,
    loading,
    loadingPhrase,
    error,
    ended,
    metaMode,
    metaMessages,
    onEnterMeta: enterMetaMode,
    onExitMeta: exitMetaMode,
    onOpenLedger: () => setShowLedger(true),
    onOpenSettings: () => setShowSettings(true),
    canUndo: canUndo(),
    onUndo: undoLastTurn,
    input,
    onInputChange,
    onKeyDown,
    onSubmit: submit,
    onSkip: skipReveal,
    onCancel: cancelRequest,
    recovery,
    onContinueNarration: continueNarration,
    onRestart: restart,
    onSave: saveCurrent,
    onOpenSaves: openSavesModal,
    onExport: exportChronicle,
    saveBanner,
    sessionTokens,
    scrollRef,
    textareaRef,
    ambienceEnabled: ambienceLevel !== "off" && !ambienceUnavailable,
    ambienceMuted,
    onToggleAmbienceMute: () => setAmbienceMuted((m) => !m),
    ttsEnabled,
    ttsMuted,
    ttsPlayback,
    onToggleTtsMute: () => setTtsMuted((m) => !m),
    onTogglePlayPause: togglePlayPause,
    onPlayEntry: playEntry
  }), showSaves && /* @__PURE__ */ React.createElement(SavesModal, {
    saves: saveList,
    totalBytes: savesTotalBytes,
    cap: SAVE_CAP,
    loading: saveListLoading,
    onClose: () => setShowSaves(false),
    onLoad: loadSave,
    onDelete: deleteSave,
    inGame: phase === "playing"
  }), showSettings && /* @__PURE__ */ React.createElement(SettingsModal, {
    settings,
    onChange: updateSetting,
    onClose: () => setShowSettings(false),
    osReducedMotion,
    ambienceLevel,
    ambienceUnavailable,
    ambienceDuringNarrationOnly,
    ambienceBoostWithTTS,
    ambienceMusicLevel,
    onChangeAmbience: setAmbienceLevel,
    onChangeAmbienceDuringNarrationOnly: setAmbienceDuringNarrationOnly,
    onChangeAmbienceBoostWithTTS: setAmbienceBoostWithTTS,
    onChangeAmbienceMusicLevel: setAmbienceMusicLevel,
    ttsEnabled,
    ttsProviderId,
    ttsProviderReady,
    ttsVoiceId,
    ttsBrowserVoices,
    ttsVoxtralVoices,
    ttsVoxtralVoicesError,
    ttsRate,
    ttsElevenKey,
    onChangeTtsEnabled: setTtsEnabled,
    onChangeTtsProvider: setTtsProviderId,
    onChangeTtsVoice: setTtsVoiceId,
    onChangeTtsRate: setTtsRate,
    onChangeTtsElevenKey: async (k) => {
      setTtsElevenKey(k);
      await saveTtsElevenLabsKey(k);
      detectTtsProviderReady();
    }
  }), showLedger && premise && /* @__PURE__ */ React.createElement(LedgerModal, {
    premise,
    gameState,
    onClose: () => setShowLedger(false)
  }), showCustom && /* @__PURE__ */ React.createElement(CustomModal, {
    onClose: () => setShowCustom(false),
    onBegin: (description) => {
      setShowCustom(false);
      beginAdventure(buildCustomPremise(description));
    },
    disabled: loading
  }), exportFallbackText !== null && /* @__PURE__ */ React.createElement(ExportFallbackModal, {
    text: exportFallbackText,
    onClose: () => setExportFallbackText(null)
  })));
}
