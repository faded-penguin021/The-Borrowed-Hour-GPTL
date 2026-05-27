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
      { id: "neutral_female",  label: "Neutral female (EN)" },
      { id: "neutral_male",    label: "Neutral male (EN)" },
      { id: "casual_female",   label: "Casual female (EN)" },
      { id: "casual_male",     label: "Casual male (EN)" },
      { id: "cheerful_female", label: "Cheerful female (EN)" },
      { id: "fr_female",       label: "Female (FR)" },
      { id: "fr_male",         label: "Male (FR)" },
      { id: "es_female",       label: "Female (ES)" },
      { id: "es_male",         label: "Male (ES)" },
      { id: "de_female",       label: "Female (DE)" },
      { id: "de_male",         label: "Male (DE)" },
      { id: "it_female",       label: "Female (IT)" },
      { id: "it_male",         label: "Male (IT)" },
      { id: "pt_female",       label: "Female (PT)" },
      { id: "pt_male",         label: "Male (PT)" },
      { id: "nl_female",       label: "Female (NL)" },
      { id: "nl_male",         label: "Male (NL)" },
      { id: "hi_female",       label: "Female (HI)" },
      { id: "hi_male",         label: "Male (HI)" },
      { id: "ar_female",       label: "Female (AR)" },
      { id: "ar_male",         label: "Male (AR)" }
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
