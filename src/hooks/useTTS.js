// @ts-check
/**
 * @import { ProviderId, TTSModelEntry, TTSVoiceEntry, ThrownError } from "../types"
 */
import { useState, useRef, useEffect } from "react";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue";
import { TTSController } from "../tts/controller";
import { getTtsElevenLabsKey, saveTtsElevenLabsKey } from "../tts/elevenLabsKey";
import { getTtsAzureKey, saveTtsAzureKey, getTtsAzureRegion, saveTtsAzureRegion } from "../tts/azureKey";
import { getTtsGoogleKey, saveTtsGoogleKey } from "../tts/googleKey";
import { fetchVoxtralVoices } from "../tts/adapters/voxtral";
import { getProviderKey } from "../llm/providers";

/**
 * @param {{ showSettings: boolean }} opts
 */
export function useTTS({ showSettings }) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);
  const [ttsProviderId, setTtsProviderId] = useState(/** @type {string | null} */ (null));
  const [ttsVoiceId, setTtsVoiceId] = useState(/** @type {string | null} */ (null));
  const [ttsModelOverrides, setTtsModelOverrides] = useState(/** @type {Record<string, string>} */ ({}));
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsElevenKey, setTtsElevenKey] = useState("");
  const [ttsAzureKey, setTtsAzureKey] = useState("");
  const [ttsAzureRegion, setTtsAzureRegion] = useState("eastus");
  const [ttsGoogleKey, setTtsGoogleKey] = useState("");
  const [ttsBrowserVoices, setTtsBrowserVoices] = useState(/** @type {SpeechSynthesisVoice[]} */ ([]));
  const [ttsVoxtralVoices, setTtsVoxtralVoices] = useState(/** @type {TTSVoiceEntry[]} */ ([]));
  const [ttsVoxtralVoicesError, setTtsVoxtralVoicesError] = useState(/** @type {string | null} */ (null));
  const [ttsProviderReady, setTtsProviderReady] = useState(/** @type {Record<string, boolean>} */ ({ browser: true, puter: true }));
  const [ttsPlayback, setTtsPlayback] = useState(/** @type {{ speaking: boolean, paused: boolean, loading: boolean, loadingTurnId: number | null, activeTurnId: number | null, lastError: string | null, lastErrorTurnId: number | null }} */ ({ speaking: false, paused: false, loading: false, loadingTurnId: null, activeTurnId: null, lastError: null, lastErrorTurnId: null }));
  const loadedRef = useRef(false);
  const ttsRef = useRef(/** @type {TTSController | null} */ (null));
  const ttsNextRef = useRef(0);

  const detectTtsProviderReady = async () => {
    /** @type {Record<string, boolean>} */
    const out = {
      browser: typeof window !== "undefined" && "speechSynthesis" in window,
      puter: true
    };
    for (const id of ["openai", "voxtral"]) {
      const meta = TTS_PROVIDER_META[id];
      try { const k = await getProviderKey(/** @type {ProviderId} */ (meta.reusesLLMKey)); out[id] = !!k; }
      catch { out[id] = false; }
    }
    out.elevenlabs = !!(ttsElevenKey || await getTtsElevenLabsKey());
    out.azure = !!(ttsAzureKey || await getTtsAzureKey().catch(() => /** @type {null} */ (null)));
    out.google = !!(ttsGoogleKey || await getTtsGoogleKey().catch(() => /** @type {null} */ (null)));
    setTtsProviderReady(out);
    return out;
  };

  const pickBestReadyProvider = (/** @type {Record<string, boolean>} */ ready) =>
    TTS_PROVIDER_ORDER.find((/** @type {string} */ id) => ready[id]) || "browser";

  const ensureTTSController = () => {
    let ctrl = ttsRef.current;
    if (!ctrl) {
      ctrl = new TTSController();
      const c = ctrl;
      c.onStateChange(() => setTtsPlayback({
        speaking: c.isSpeaking(),
        paused: c.isPaused(),
        loading: c.isLoading(),
        loadingTurnId: c.loadingFor(),
        activeTurnId: c.activeTurnId,
        lastError: c.lastError,
        lastErrorTurnId: c.lastErrorTurnId
      }));
      ttsRef.current = ctrl;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const reload = () => setTtsBrowserVoices(window.speechSynthesis.getVoices().slice());
        reload();
        window.speechSynthesis.onvoiceschanged = reload;
      }
    }
    return ctrl;
  };

  /**
   * @param {any[]} entries
   * @param {number} idx
   */
  const playEntry = async (entries, idx) => {
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
    if (!ttsEnabled) setTtsEnabled(true);
    if (ttsMuted) setTtsMuted(false);
    ctrl.setEnabled(true);
    ctrl.setMuted(false);
    let providerId = ttsProviderId;
    if (!providerId) {
      const ready = await detectTtsProviderReady();
      providerId = pickBestReadyProvider(ready);
      setTtsProviderId(providerId);
    }
    const meta = TTS_PROVIDER_META[providerId];
    if (meta) {
      let key = null;
      let region = null;
      if (meta.reusesLLMKey) { try { key = await getProviderKey(/** @type {ProviderId} */ (meta.reusesLLMKey)); } catch {} }
      else if (providerId === "elevenlabs") key = ttsElevenKey || (await getTtsElevenLabsKey().catch(() => /** @type {null} */ (null)));
      else if (providerId === "azure") {
        key = ttsAzureKey || (await getTtsAzureKey().catch(() => /** @type {null} */ (null)));
        region = ttsAzureRegion;
      }
      else if (providerId === "google") key = ttsGoogleKey || (await getTtsGoogleKey().catch(() => /** @type {null} */ (null)));
      ctrl.setProvider(providerId, { voiceId: ttsVoiceId, key, model: ttsModelOverrides[providerId] || null, region });
    }
    ctrl.speak(e.text, { turnId: idx });
  };

  /** @param {any[]} entries */
  const togglePlayPause = (entries) => {
    const ctrl = ensureTTSController();
    if (ctrl.isPaused()) { ctrl.resume(); return; }
    if (ctrl.isSpeaking()) { ctrl.pause(); return; }
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e?.type === "narration" && e.fullyRevealed && typeof e.text === "string" && e.text.trim()) {
        ctrl.speak(e.text, { turnId: i });
        return;
      }
    }
  };

  useEffect(() => { ttsRef.current?.setEnabled(ttsEnabled); }, [ttsEnabled]);
  useEffect(() => { ttsRef.current?.setMuted(ttsMuted); }, [ttsMuted]);
  useEffect(() => { ttsRef.current?.setRate(ttsRate); }, [ttsRate]);
  useEffect(() => { ttsRef.current?.setVoice(ttsVoiceId); }, [ttsVoiceId]);

  useEffect(() => {
    if (!ttsProviderId) return;
    (async () => {
      const ctrl = ensureTTSController();
      const meta = TTS_PROVIDER_META[ttsProviderId];
      if (!meta) return;
      let key = null;
      let region = null;
      if (meta.reusesLLMKey) { try { key = await getProviderKey(/** @type {ProviderId} */ (meta.reusesLLMKey)); } catch {} }
      else if (ttsProviderId === "elevenlabs") key = ttsElevenKey || (await getTtsElevenLabsKey().catch(() => /** @type {null} */ (null)));
      else if (ttsProviderId === "azure") {
        key = ttsAzureKey || (await getTtsAzureKey().catch(() => /** @type {null} */ (null)));
        region = ttsAzureRegion;
      }
      else if (ttsProviderId === "google") key = ttsGoogleKey || (await getTtsGoogleKey().catch(() => /** @type {null} */ (null)));
      ctrl.setProvider(ttsProviderId, { voiceId: ttsVoiceId, key, model: ttsModelOverrides[ttsProviderId] || null, region });
    })();
  }, [ttsProviderId, ttsVoiceId, ttsElevenKey, ttsAzureKey, ttsAzureRegion, ttsGoogleKey, ttsModelOverrides]);

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
            if (p.modelOverrides && typeof p.modelOverrides === "object") {
              /** @type {Record<string, string>} */
              const clean = {};
              for (const [provId, modelId] of Object.entries(p.modelOverrides)) {
                const meta = TTS_PROVIDER_META[provId];
                if (!meta || typeof modelId !== "string") continue;
                const inPresets = (meta.models || []).some((/** @type {TTSModelEntry} */ m) => m.id === modelId);
                if (inPresets) clean[provId] = modelId;
              }
              setTtsModelOverrides(clean);
            }
          }
        }
      } catch {} finally {
        loadedRef.current = true;
      }
    })();
    detectTtsProviderReady();
    (async () => {
      const k = await getTtsElevenLabsKey().catch(() => /** @type {null} */ (null));
      if (k) setTtsElevenKey(k);
    })();
    (async () => {
      const k = await getTtsAzureKey().catch(() => /** @type {null} */ (null));
      if (k) setTtsAzureKey(k);
      const r = getTtsAzureRegion();
      setTtsAzureRegion(r || "eastus");
    })();
    (async () => {
      const k = await getTtsGoogleKey().catch(() => /** @type {null} */ (null));
      if (k) setTtsGoogleKey(k);
    })();
  }, []);

  // Persist prefs whenever they change.
  useEffect(() => {
    if (!loadedRef.current) return;
    (async () => {
      try {
        await window.storage.set("borrowed:tts:v1", JSON.stringify({
          enabled: ttsEnabled, muted: ttsMuted,
          providerId: ttsProviderId, voiceId: ttsVoiceId, rate: ttsRate,
          modelOverrides: ttsModelOverrides
        }));
      } catch {}
    })();
  }, [ttsEnabled, ttsMuted, ttsProviderId, ttsVoiceId, ttsRate, ttsModelOverrides]);

  // Re-check provider readiness when settings panel opens.
  useEffect(() => { if (showSettings) detectTtsProviderReady(); }, [showSettings]);

  // Fetch Voxtral voice catalogue.
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
        if (!cancelled) setTtsVoxtralVoicesError(/** @type {ThrownError} */ (e)?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [ttsProviderId, showSettings]);

  /**
   * Walk entries and auto-speak newly revealed narration.
   * @param {any[]} entries
   */
  const autoSpeak = (entries) => {
    if (!ttsEnabled || ttsMuted) {
      ttsNextRef.current = entries.length;
      return;
    }
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
      break;
    }
  };

  const stopTTS = () => {
    if (ttsRef.current) ttsRef.current.stop();
  };

  const resetTTSCursor = (/** @type {number} */ position) => {
    ttsNextRef.current = position;
  };

  return {
    ttsEnabled, setTtsEnabled,
    ttsMuted, setTtsMuted,
    ttsProviderId, setTtsProviderId,
    ttsVoiceId, setTtsVoiceId,
    ttsModelOverrides, setTtsModelOverrides,
    ttsRate, setTtsRate,
    ttsElevenKey, setTtsElevenKey,
    ttsAzureKey, setTtsAzureKey,
    ttsAzureRegion, setTtsAzureRegion,
    ttsGoogleKey, setTtsGoogleKey,
    ttsBrowserVoices,
    ttsVoxtralVoices, ttsVoxtralVoicesError,
    ttsProviderReady,
    ttsPlayback,
    ttsRef,
    ensureTTSController,
    detectTtsProviderReady,
    playEntry,
    togglePlayPause,
    autoSpeak,
    stopTTS,
    resetTTSCursor,
    saveTtsElevenLabsKey,
    saveTtsAzureKey,
    saveTtsAzureRegion,
    saveTtsGoogleKey,
  };
}
