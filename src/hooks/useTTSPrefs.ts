import { useState, useRef, useEffect } from "react";
import { TTS_PROVIDER_META } from "../tts/catalogue";
import { getTtsElevenLabsKey } from "../tts/elevenLabsKey";
import { getTtsAzureKey, getTtsAzureRegion } from "../tts/azureKey";
import { getTtsGoogleKey } from "../tts/googleKey";
import { dlog } from "../debug/debugLog";

export function useTTSPrefs() {
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
  const loadedRef = useRef(false);

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
      } catch (e) { dlog("tts:prefs:load-error", e); } finally {
        loadedRef.current = true;
      }
    })();
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
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    (async () => {
      try {
        await window.storage.set("borrowed:tts:v1", JSON.stringify({
          enabled: ttsEnabled, muted: ttsMuted,
          providerId: ttsProviderId, voiceId: ttsVoiceId, rate: ttsRate,
          modelOverrides: ttsModelOverrides
        }));
      } catch (e) { dlog("tts:prefs:save-error", e); }
    })();
  }, [ttsEnabled, ttsMuted, ttsProviderId, ttsVoiceId, ttsRate, ttsModelOverrides]);

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
    loadedRef,
  };
}
