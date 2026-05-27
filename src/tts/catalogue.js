import { BrowserTTSAdapter } from "./adapters/browser.js";
import { PuterTTSAdapter } from "./adapters/puter.js";
import { OpenAITTSAdapter } from "./adapters/openai.js";
import { VoxtralTTSAdapter } from "./adapters/voxtral.js";
import { ElevenLabsTTSAdapter } from "./adapters/elevenlabs.js";

// ── Provider catalogue ───────────────────────────────────────────────────
export var TTS_PROVIDER_META = {
  browser: {
    id: "browser", name: "Browser", requiresKey: false, reusesLLMKey: null,
    voices: [], // populated from speechSynthesis at runtime
    adapter: BrowserTTSAdapter
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
    adapter: PuterTTSAdapter
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
    adapter: OpenAITTSAdapter
  },
  voxtral: {
    id: "voxtral", name: "Voxtral", requiresKey: true, reusesLLMKey: "mistral",
    voices: [
      { id: "jane_confident",  label: "Jane — confident (EN)" },
      { id: "casual_male",     label: "Casual male (EN)" },
      { id: "casual_female",   label: "Casual female (EN)" },
      { id: "vivian",          label: "Vivian (EN)" }
    ],
    model: "voxtral-mini-tts-2603",
    adapter: VoxtralTTSAdapter,
    allowCustomVoiceId: true
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
    adapter: ElevenLabsTTSAdapter
  }
};
// Quality-first order; first "ready" provider wins on auto-select.
export var TTS_PROVIDER_ORDER = ["openai", "elevenlabs", "voxtral", "puter", "browser"];
