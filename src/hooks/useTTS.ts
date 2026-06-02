import { useState, useRef, useEffect } from "react";
import type { Entry, ProviderId, TTSVoiceEntry } from "../types";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue";
import { TTSController } from "../tts/controller";
import { getTtsElevenLabsKey, saveTtsElevenLabsKey } from "../tts/elevenLabsKey";
import { getTtsAzureKey, saveTtsAzureKey, getTtsAzureRegion, saveTtsAzureRegion } from "../tts/azureKey";
import { getTtsGoogleKey, saveTtsGoogleKey } from "../tts/googleKey";
import { getProviderKey } from "../llm/providers";

interface TtsPlayback {
  speaking: boolean;
  paused: boolean;
  loading: boolean;
  loadingTurnId: number | null;
  activeTurnId: number | null;
  lastError: string | null;
  lastErrorTurnId: number | null;
}

export function useTTS({ showSettings }: { showSettings: boolean }) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);
  const [ttsProviderId, setTtsProviderId] = useState<string | null>(null);
  const [ttsVoiceId, setTtsVoiceId] = useState<string | null>(null);
  const [ttsModelOverrides, setTtsModelOverrides] = useState<Record<string, string>>({});
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsElevenKey, setTtsElevenKey] = useState("");
  const [ttsAzureKey, setTtsAzureKey] = useState("");
  const [ttsAzureRegion, setTtsAzureRegion] = useState("eastus");
  const [ttsGoogleKey, setTtsGoogleKey] = useState("");
  const [ttsBrowserVoices, setTtsBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsVoxtralVoices, setTtsVoxtralVoices] = useState<TTSVoiceEntry[]>([]);
  const [ttsVoxtralVoicesError, setTtsVoxtralVoicesError] = useState<string | null>(null);
  const [ttsProviderReady, setTtsProviderReady] = useState<Record<string, boolean>>({ browser: true, puter: true });
  const [ttsPlayback, setTtsPlayback] = useState<TtsPlayback>({ speaking: false, paused: false, loading: false, loadingTurnId: null, activeTurnId: null, lastError: null, lastErrorTurnId: null });
  const loadedRef = useRef(false);
  const ttsRef = useRef<TTSController | null>(null);
  const ttsNextRef = useRef(0);

  const detectTtsProviderReady = async (): Promise<Record<string, boolean>> => {
    const out: Record<string, boolean> = {
      browser: typeof window !== "undefined" && "speechSynthesis" in window,
      puter: true
    };
    for (const id of ["openai", "voxtral"]) {
      const meta = TTS_PROVIDER_META[id];
      try { const k = await getProviderKey(meta.reusesLLMKey as ProviderId); out[id] = !!k; }
      catch { out[id] = false; }
    }
    out.elevenlabs = !!(ttsElevenKey || await getTtsElevenLabsKey());
    out.azure = !!(ttsAzureKey || await getTtsAzureKey().catch(() => null));
    out.google = !!(ttsGoogleKey || await getTtsGoogleKey().catch(() => null));
    setTtsProviderReady(out);
    return out;
  };

  const pickBestReadyProvider = (ready: Record<string, boolean>) =>
    TTS_PROVIDER_ORDER.find((id) => ready[id]) || "browser";

  const ensureTTSController = (): TTSController => {
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

  // Resolve the secret/region for a provider from in-memory state, falling back
  // to persisted storage. Shared by the play paths and the provider-sync effect
  // so the controller is never handed a stale or missing key.
  const resolveProviderCreds = async (providerId: string): Promise<{ key: string | null; region: string | null }> => {
    const meta = TTS_PROVIDER_META[providerId];
    let key: string | null = null;
    let region: string | null = null;
    if (!meta) return { key, region };
    if (meta.reusesLLMKey) { try { key = await getProviderKey(meta.reusesLLMKey as ProviderId); } catch {} }
    else if (providerId === "elevenlabs") key = ttsElevenKey || (await getTtsElevenLabsKey().catch(() => null));
    else if (providerId === "azure") {
      key = ttsAzureKey || (await getTtsAzureKey().catch(() => null));
      region = ttsAzureRegion;
    }
    else if (providerId === "google") key = ttsGoogleKey || (await getTtsGoogleKey().catch(() => null));
    return { key, region };
  };

  // Push the current provider + resolved credentials onto the controller.
  const applyProviderToController = async (ctrl: TTSController, providerId: string) => {
    const meta = TTS_PROVIDER_META[providerId];
    if (!meta) return;
    const { key, region } = await resolveProviderCreds(providerId);
    ctrl.setProvider(providerId, { voiceId: ttsVoiceId, key, model: ttsModelOverrides[providerId] || null, region });
  };

  const playEntry = async (entries: Entry[], idx: number) => {
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
    await applyProviderToController(ctrl, providerId);
    ctrl.speak(e.text, { turnId: idx });
  };

  const togglePlayPause = (entries: Entry[]) => {
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
      await applyProviderToController(ctrl, ttsProviderId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyProviderToController is redefined each render from these same inputs and is intentionally excluded to avoid re-running on every render
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
              const clean: Record<string, string> = {};
              for (const [provId, modelId] of Object.entries(p.modelOverrides)) {
                const meta = TTS_PROVIDER_META[provId];
                if (!meta || typeof modelId !== "string") continue;
                const inPresets = (meta.models || []).some((m) => m.id === modelId);
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
      const k = await getTtsElevenLabsKey().catch(() => null);
      if (k) setTtsElevenKey(k);
    })();
    (async () => {
      const k = await getTtsAzureKey().catch(() => null);
      if (k) setTtsAzureKey(k);
      const r = getTtsAzureRegion();
      setTtsAzureRegion(r || "eastus");
    })();
    (async () => {
      const k = await getTtsGoogleKey().catch(() => null);
      if (k) setTtsGoogleKey(k);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount load; detectTtsProviderReady is intentionally not a trigger here
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the panel opening; detectTtsProviderReady is stable enough and intentionally excluded
  useEffect(() => { if (showSettings) detectTtsProviderReady(); }, [showSettings]);

  // Fetch Voxtral voice catalogue.
  useEffect(() => {
    if (ttsProviderId !== "voxtral") return;
    if (!showSettings && ttsVoxtralVoices.length > 0) return;
    let cancelled = false;
    (async () => {
      let key: string | null = null;
      try { key = await getProviderKey("mistral"); } catch {}
      if (!key) return;
      try {
        // Loaded dynamically so the voxtral adapter stays in its own code-split
        // chunk alongside the other TTS adapters (see tts/catalogue.ts).
        const { fetchVoxtralVoices } = await import("../tts/adapters/voxtral");
        const voices = await fetchVoxtralVoices(key);
        if (!cancelled) { setTtsVoxtralVoices(voices); setTtsVoxtralVoicesError(null); }
      } catch (e) {
        if (!cancelled) setTtsVoxtralVoicesError((e as { message?: string })?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch keyed on provider + panel state; ttsVoxtralVoices.length is read as a guard, not a trigger
  }, [ttsProviderId, showSettings]);

  /** Walk entries and auto-speak newly revealed narration. */
  const autoSpeak = (entries: Entry[]) => {
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
      if (typeof e.text === "string" && e.text.trim()) {
        // Resolve and apply the provider credentials before speaking. The async
        // provider-sync effect also keys on ttsProviderId, but on the very first
        // narration of an hour it may not have settled yet — speaking without
        // this would hand the controller a null key and yield an HTTP 401.
        const providerId = ttsProviderId;
        applyProviderToController(ctrl, providerId).then(() => ctrl.speak(e.text as string, { turnId: i }));
      }
      ttsNextRef.current++;
      break;
    }
  };

  const stopTTS = () => {
    if (ttsRef.current) ttsRef.current.stop();
  };

  const resetTTSCursor = (position: number) => {
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
