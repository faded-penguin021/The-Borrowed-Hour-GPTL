// The single declaration of every remote origin this app may contact.
// `index.html`'s CSP `connect-src` must match this list exactly, in both
// directions — `src/security/origins.test.ts` enforces the correspondence.
// When adding a provider: add its origin here AND to the CSP meta tag in the
// same commit, and say what it is for.

export const CONNECT_SRC_ORIGINS: readonly string[] = [
  // ── LLM providers ──────────────────────────────────────────────────
  "https://api.openai.com", //                OpenAI (LLM + imaging + TTS)
  "https://generativelanguage.googleapis.com", // Google Gemini
  "https://api.anthropic.com", //             Anthropic Claude
  "https://api.deepseek.com", //              DeepSeek
  "https://dashscope.aliyuncs.com", //        Alibaba Qwen
  "https://api.moonshot.cn", //               Moonshot Kimi
  "https://qianfan.baidubce.com", //          Baidu Ernie
  "https://api.mistral.ai", //                Mistral (LLM + Voxtral TTS)
  "https://api.groq.com", //                  Groq
  "https://openrouter.ai", //                 OpenRouter
  "https://api.cerebras.ai", //               Cerebras
  // ── TTS providers ──────────────────────────────────────────────────
  "https://api.elevenlabs.io", //             ElevenLabs
  "https://texttospeech.googleapis.com", //   Google Cloud TTS
  "https://*.tts.speech.microsoft.com", //    Azure TTS (region-scoped host)
  "https://*.puter.com", //                   Puter (opt-in third party)
  // ── Imaging providers & their result CDNs ──────────────────────────
  "https://image.pollinations.ai", //         Pollinations
  "https://api.replicate.com", //             Replicate API
  "https://replicate.delivery", //            Replicate result CDN
  "https://*.replicate.delivery",
  "https://oaidalleapiprodscus.blob.core.windows.net", // DALL-E result blobs
  // ── Local LLMs / user-owned proxy (Ollama, LM Studio, BYOB) ────────
  "http://localhost:*",
  "http://127.0.0.1:*",
  "https://localhost:*",
  "https://127.0.0.1:*",
];
