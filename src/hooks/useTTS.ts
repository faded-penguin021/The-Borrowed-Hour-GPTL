import { useState, useRef, useEffect } from "react";
import type { Entry } from "../types";
import { TTSController } from "../tts/controller";
import { saveTtsElevenLabsKey } from "../tts/elevenLabsKey";
import { saveTtsAzureKey, saveTtsAzureRegion } from "../tts/azureKey";
import { saveTtsGoogleKey } from "../tts/googleKey";
import { useTTSPrefs } from "./useTTSPrefs";
import { useTTSProvider } from "./useTTSProvider";

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
  const prefs = useTTSPrefs();
  const provider = useTTSProvider({
    ttsProviderId: prefs.ttsProviderId,
    ttsVoiceId: prefs.ttsVoiceId,
    ttsElevenKey: prefs.ttsElevenKey,
    ttsAzureKey: prefs.ttsAzureKey,
    ttsAzureRegion: prefs.ttsAzureRegion,
    ttsGoogleKey: prefs.ttsGoogleKey,
    ttsModelOverrides: prefs.ttsModelOverrides,
    showSettings,
  });

  const [ttsPlayback, setTtsPlayback] = useState<TtsPlayback>({ speaking: false, paused: false, loading: false, loadingTurnId: null, activeTurnId: null, lastError: null, lastErrorTurnId: null });
  const ttsRef = useRef<TTSController | null>(null);
  const ttsNextRef = useRef(0);

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
    }
    return ctrl;
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
    if (!prefs.ttsEnabled) prefs.setTtsEnabled(true);
    if (prefs.ttsMuted) prefs.setTtsMuted(false);
    ctrl.setEnabled(true);
    ctrl.setMuted(false);
    let providerId = prefs.ttsProviderId;
    if (!providerId) {
      const ready = await provider.detectTtsProviderReady();
      providerId = provider.pickBestReadyProvider(ready);
      prefs.setTtsProviderId(providerId);
    }
    await provider.applyProviderToController(ctrl, providerId);
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

  useEffect(() => { ttsRef.current?.setEnabled(prefs.ttsEnabled); }, [prefs.ttsEnabled]);
  useEffect(() => { ttsRef.current?.setMuted(prefs.ttsMuted); }, [prefs.ttsMuted]);
  useEffect(() => { ttsRef.current?.setRate(prefs.ttsRate); }, [prefs.ttsRate]);
  useEffect(() => { ttsRef.current?.setVoice(prefs.ttsVoiceId); }, [prefs.ttsVoiceId]);

  useEffect(() => {
    if (!prefs.ttsProviderId) return;
    (async () => {
      const ctrl = ensureTTSController();
      await provider.applyProviderToController(ctrl, prefs.ttsProviderId!);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.ttsProviderId, prefs.ttsVoiceId, prefs.ttsElevenKey, prefs.ttsAzureKey, prefs.ttsAzureRegion, prefs.ttsGoogleKey, prefs.ttsModelOverrides]);

  const autoSpeak = (entries: Entry[]) => {
    if (!prefs.ttsEnabled || prefs.ttsMuted) {
      ttsNextRef.current = entries.length;
      return;
    }
    if (!prefs.ttsProviderId) {
      provider.detectTtsProviderReady().then((ready) => prefs.setTtsProviderId(provider.pickBestReadyProvider(ready)));
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
        const providerId = prefs.ttsProviderId;
        provider.applyProviderToController(ctrl, providerId).then(() => ctrl.speak(e.text as string, { turnId: i }));
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
    ttsEnabled: prefs.ttsEnabled, setTtsEnabled: prefs.setTtsEnabled,
    ttsMuted: prefs.ttsMuted, setTtsMuted: prefs.setTtsMuted,
    ttsProviderId: prefs.ttsProviderId, setTtsProviderId: prefs.setTtsProviderId,
    ttsVoiceId: prefs.ttsVoiceId, setTtsVoiceId: prefs.setTtsVoiceId,
    ttsModelOverrides: prefs.ttsModelOverrides, setTtsModelOverrides: prefs.setTtsModelOverrides,
    ttsRate: prefs.ttsRate, setTtsRate: prefs.setTtsRate,
    ttsElevenKey: prefs.ttsElevenKey, setTtsElevenKey: prefs.setTtsElevenKey,
    ttsAzureKey: prefs.ttsAzureKey, setTtsAzureKey: prefs.setTtsAzureKey,
    ttsAzureRegion: prefs.ttsAzureRegion, setTtsAzureRegion: prefs.setTtsAzureRegion,
    ttsGoogleKey: prefs.ttsGoogleKey, setTtsGoogleKey: prefs.setTtsGoogleKey,
    ttsBrowserVoices: provider.ttsBrowserVoices,
    ttsVoxtralVoices: provider.ttsVoxtralVoices, ttsVoxtralVoicesError: provider.ttsVoxtralVoicesError,
    ttsProviderReady: provider.ttsProviderReady,
    ttsPlayback,
    ttsRef,
    ensureTTSController,
    detectTtsProviderReady: provider.detectTtsProviderReady,
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
