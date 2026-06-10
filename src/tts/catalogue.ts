import type { TTSProviderMeta } from "../types";
// ── Provider catalogue ───────────────────────────────────────────────────
// checked: 2026-06-02
export const TTS_PROVIDER_META: Record<string, TTSProviderMeta> = {
  browser: {
    id: "browser", name: "Browser", requiresKey: false, reusesLLMKey: null,
    voices: [], // populated from speechSynthesis at runtime
    adapterLoader: () => import("./adapters/browser").then(m => m.BrowserTTSAdapter)
  },
  puter: {
    id: "puter", name: "Puter", requiresKey: false, reusesLLMKey: null,
    voices: [
      { id: "Joanna",   label: "Joanna — US (neutral)" },
      { id: "Matthew",  label: "Matthew — US (warm)" },
      { id: "Salli",    label: "Salli — US (bright)" },
      { id: "Kimberly", label: "Kimberly — US (smooth)" },
      { id: "Kendra",   label: "Kendra — US (steady)" },
      { id: "Joey",     label: "Joey — US (casual)" },
      { id: "Justin",   label: "Justin — US (youthful)" },
      { id: "Ivy",      label: "Ivy — US child" },
      { id: "Brian",    label: "Brian — UK (steady)" },
      { id: "Amy",      label: "Amy — UK (lyrical)" },
      { id: "Emma",     label: "Emma — UK (composed)" },
      { id: "Olivia",   label: "Olivia — AU (cool)" },
      { id: "Aria",     label: "Aria — generative" },
      { id: "Ruth",     label: "Ruth — generative" }
    ],
    adapterLoader: () => import("./adapters/puter").then(m => m.PuterTTSAdapter)
  },
  openai: {
    id: "openai", name: "OpenAI", requiresKey: true, reusesLLMKey: "openai",
    voices: [
      { id: "alloy",   label: "Alloy — neutral" },
      { id: "ash",     label: "Ash — gentle" },
      { id: "ballad",  label: "Ballad — narrative" },
      { id: "coral",   label: "Coral — bright" },
      { id: "echo",    label: "Echo — measured" },
      { id: "fable",   label: "Fable — storyteller" },
      { id: "nova",    label: "Nova — warm" },
      { id: "onyx",    label: "Onyx — deep" },
      { id: "sage",    label: "Sage — calm" },
      { id: "shimmer", label: "Shimmer — clear" },
      { id: "verse",   label: "Verse — expressive" }
    ],
    model: "gpt-4o-mini-tts",
    models: [
      { id: "gpt-4o-mini-tts", tier: "expressive" },
      { id: "tts-1", tier: "legacy-fast" },
      { id: "tts-1-hd", tier: "legacy-quality" }
    ],
    adapterLoader: () => import("./adapters/openai").then(m => m.OpenAITTSAdapter)
  },
  voxtral: {
    // Voice list comes from the API at /v1/audio/voices — the hosted catalog
    // diverges from the open-weight presets, so static IDs go stale fast.
    // en_paul_neutral is the confirmed default fallback if the fetch fails.
    id: "voxtral", name: "Voxtral", requiresKey: true, reusesLLMKey: "mistral",
    voices: [
      { id: "en_paul_neutral", label: "Paul — neutral (EN)" }
    ],
    model: "voxtral-mini-tts-2603",
    models: [
      { id: "voxtral-mini-tts-2603", tier: "fast" }
    ],
    allowCustomVoiceId: true,
    adapterLoader: () => import("./adapters/voxtral").then(m => m.VoxtralTTSAdapter)
  },
  elevenlabs: {
    id: "elevenlabs", name: "ElevenLabs", requiresKey: true, reusesLLMKey: null,
    allowCustomVoiceId: true,
    keyStorage: "borrowed:tts_elevenlabs_key:v1",
    voices: [
      { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — calm" },
      { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi — confident" },
      { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella — soft" },
      { id: "ErXwobaYiN019PkySvjV",  label: "Antoni — warm" },
      { id: "TxGEqnHWrfWFTfGW9XjX",  label: "Josh — deep" }
    ],
    model: "eleven_turbo_v2_5",
    models: [
      { id: "eleven_turbo_v2_5", tier: "fast" },
      { id: "eleven_flash_v2_5", tier: "fastest" },
      { id: "eleven_multilingual_v2", tier: "quality" },
      { id: "eleven_v3", tier: "flagship" }
    ],
    adapterLoader: () => import("./adapters/elevenlabs").then(m => m.ElevenLabsTTSAdapter)
  },
  azure: {
    id: "azure", name: "Azure", requiresKey: true, reusesLLMKey: null,
    keyStorage: "borrowed:tts_azure_key:v1",
    allowCustomVoiceId: true,
    voices: [
      { id: "en-US-JennyNeural", label: "Jenny — US Neural (warm)" },
      { id: "en-US-GuyNeural",   label: "Guy — US Neural (deep)" },
      { id: "en-US-AriaNeural",  label: "Aria — US Neural (expressive)" },
      { id: "en-GB-SoniaNeural", label: "Sonia — UK Neural (confident)" },
      { id: "en-GB-RyanNeural",  label: "Ryan — UK Neural (authoritative)" },
      { id: "en-AU-NatashaNeural", label: "Natasha — AU Neural (bright)" }
    ],
    model: "", models: [],
    adapterLoader: () => import("./adapters/azure").then(m => m.AzureTTSAdapter)
  },
  google: {
    id: "google", name: "Google", requiresKey: true, reusesLLMKey: null,
    keyStorage: "borrowed:tts_google_key:v1",
    allowCustomVoiceId: true,
    voices: [
      { id: "en-US-Neural2-C",  label: "Neural2-C — US female (clear)" },
      { id: "en-US-Neural2-J",  label: "Neural2-J — US male (warm)" },
      { id: "en-US-Wavenet-D",  label: "Wavenet-D — US male (deep)" },
      { id: "en-US-Wavenet-F",  label: "Wavenet-F — US female (bright)" },
      { id: "en-GB-Neural2-A",  label: "Neural2-A — UK female (lyrical)" },
      { id: "en-GB-Neural2-B",  label: "Neural2-B — UK male (calm)" }
    ],
    model: "", models: [],
    adapterLoader: () => import("./adapters/google").then(m => m.GoogleTTSAdapter)
  }
};
// Quality-first order; first "ready" provider wins on auto-select.
export const TTS_PROVIDER_ORDER = ["openai", "elevenlabs", "voxtral", "azure", "google", "puter", "browser"];
