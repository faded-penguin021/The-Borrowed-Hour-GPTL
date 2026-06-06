import { useState, useEffect } from "react";
import type { ProviderId, TTSVoiceEntry } from "../types";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue";
import type { TTSController } from "../tts/controller";
import { getTtsElevenLabsKey } from "../tts/elevenLabsKey";
import { getTtsAzureKey } from "../tts/azureKey";
import { getTtsGoogleKey } from "../tts/googleKey";
import { getProviderKey } from "../llm/providers";

export interface TTSProviderState {
  ttsProviderReady: Record<string, boolean>;
  ttsBrowserVoices: SpeechSynthesisVoice[];
  ttsVoxtralVoices: TTSVoiceEntry[];
  ttsVoxtralVoicesError: string | null;
  detectTtsProviderReady: () => Promise<Record<string, boolean>>;
  pickBestReadyProvider: (ready: Record<string, boolean>) => string;
  resolveProviderCreds: (providerId: string) => Promise<{ key: string | null; region: string | null }>;
  applyProviderToController: (ctrl: TTSController, providerId: string) => Promise<void>;
}

export function useTTSProvider({
  ttsProviderId,
  ttsVoiceId,
  ttsElevenKey,
  ttsAzureKey,
  ttsAzureRegion,
  ttsGoogleKey,
  ttsModelOverrides,
  showSettings,
}: {
  ttsProviderId: string | null;
  ttsVoiceId: string | null;
  ttsElevenKey: string;
  ttsAzureKey: string;
  ttsAzureRegion: string;
  ttsGoogleKey: string;
  ttsModelOverrides: Record<string, string>;
  showSettings: boolean;
}): TTSProviderState {
  const [ttsProviderReady, setTtsProviderReady] = useState<Record<string, boolean>>({ browser: true, puter: true });
  const [ttsBrowserVoices, setTtsBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsVoxtralVoices, setTtsVoxtralVoices] = useState<TTSVoiceEntry[]>([]);
  const [ttsVoxtralVoicesError, setTtsVoxtralVoicesError] = useState<string | null>(null);

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

  const applyProviderToController = async (ctrl: TTSController, providerId: string) => {
    const meta = TTS_PROVIDER_META[providerId];
    if (!meta) return;
    const { key, region } = await resolveProviderCreds(providerId);
    ctrl.setProvider(providerId, { voiceId: ttsVoiceId, key, model: ttsModelOverrides[providerId] || null, region });
  };

  // Load browser voices on first mount.
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const reload = () => setTtsBrowserVoices(window.speechSynthesis.getVoices().slice());
      reload();
      window.speechSynthesis.onvoiceschanged = reload;
    }
    detectTtsProviderReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check provider readiness when settings panel opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const { fetchVoxtralVoices } = await import("../tts/adapters/voxtral");
        const voices = await fetchVoxtralVoices(key);
        if (!cancelled) { setTtsVoxtralVoices(voices); setTtsVoxtralVoicesError(null); }
      } catch (e) {
        if (!cancelled) setTtsVoxtralVoicesError((e as { message?: string })?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsProviderId, showSettings]);

  return {
    ttsProviderReady,
    ttsBrowserVoices,
    ttsVoxtralVoices,
    ttsVoxtralVoicesError,
    detectTtsProviderReady,
    pickBestReadyProvider,
    resolveProviderCreds,
    applyProviderToController,
  };
}
