# The Borrowed Hour

A literary interactive text adventure with built-in scenarios and a custom "Wild" mode. The API provider and models are chosen at runtime from the Settings panel — twelve providers are supported, from major cloud APIs to a local LLM endpoint.

Originally a single-file HTML artifact; now a small Vite + React + Tailwind project. The `App` component still lives as one file (`src/App.jsx`); peripheral components, data, LLM adapters, TTS adapters, and the ambience engine are split into their own modules under `src/`.

## Run

### Development

```bash
npm install
npm run dev
```

Then visit <http://localhost:5173>.

### Production build

```bash
npm run build
```

The built site is written to `dist/`. Preview it locally with `npm run preview`.

Pushes to `main` build and publish the app to GitHub Pages via `.github/workflows/pages.yml`.

## Choosing engines

Open **⚙ Settings** from the title screen and find the **Story engines** section. Three separate models handle distinct roles:

- **Opening scene** — writes the voice-setting first turn.
- **GM logic** — the hidden rules layer; adjudicates actions and updates game state.
- **Narration & discussion** — renders player-facing prose each turn and post-game discussion.

Pick a **Model stack** to fill all three roles from one provider's preset at once. Enable **Free model selection** to override the stack and choose a provider and model for each role independently — you can mix providers across roles or enter a custom model ID. Selections are saved in the browser between sessions.

### Default stack

The default **Free (Mistral)** stack pairs a fuller model on the one-off opening with mid-tier models on the repeated loop. All models have free API tier access:

| Role | Default |
|---|---|
| Opening scene | Mistral `mistral-large-latest` |
| GM logic | Mistral `mistral-medium-latest` |
| Narration & discussion | Mistral `mistral-medium-latest` |

Mistral's free tier on the experimental API is generous enough for repeated per-turn calls without rate-limit collisions.

### Preset model lists

| Provider | Models |
|---|---|
| **Gemini** | `gemini-3.5-flash` |
| **OpenAI** | `gpt-5.4-mini`, `gpt-5-mini`, `gpt-5.4-nano` |
| **Claude** | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **DeepSeek** | `deepseek-v4-flash` |
| **Qwen** | `qwen-plus`, `qwen-flash` |
| **Kimi** | `kimi-k2.5` |
| **ERNIE** | `ernie-4.5-turbo-128k`, `ernie-4.5-turbo-32k` |
| **Mistral** | `mistral-small-latest`, `mistral-medium-latest` (both free), `mistral-large-latest` (free) |
| **Groq** | `llama-3.3-70b-versatile`, `meta-llama/llama-4-scout-17b-16e-instruct`, `openai/gpt-oss-120b` |
| **OpenRouter** | `deepseek/deepseek-v4-flash:free`, `z-ai/glm-4.5-air:free`, `anthropic/claude-sonnet-4-6`, `openai/gpt-5.4-mini` |
| **Cerebras** | `llama-3.3-70b`, `gpt-oss-120b` |
| **Local LLM** | `llama3.2`, `llama3.1`, `mistral`, `phi3`, `qwen2.5` (or any custom ID) |

### Free-tier notes

Each GM turn sends a large request — system prompt, tool schema, and the rolling chronicle history. Free tiers differ in how much they allow per request and per minute:

- **Mistral** (default) has generous free API access with no per-minute token limits, making it the most reliable free option. Both medium and large models are available on the free tier.
- **Gemini** (`gemini-3.5-flash`) has daily request quotas but no per-minute caps; suitable for casual play but capped at ~20 games/day.
- **Groq** rejects requests larger than the model's per-minute budget. Uses `llama-3.3-70b-versatile` by default for higher throughput; very long sessions can still exceed limits.
- **Cerebras**' free tier caps context at 8,192 tokens — too small for a GM turn — so paid tier is required here.
- **OpenRouter** free models (`deepseek-v4-flash:free`) have tight per-minute caps and are not recommended for repeated calls.

## Read aloud (text-to-speech)

A narration voice can be enabled from **⚙ Reading → Read aloud (text-to-speech)**. When enabled, a small ♪ Hear button appears under every narration passage and (optionally) each new passage auto-plays as it arrives. A **HUSH** button appears in the header while the narrator is speaking.

Six providers are supported:

| Provider | Key required? | Free tier |
|---|---|---|
| **Browser (Web Speech)** | No | Free, offline, uses your OS voices |
| **Puter.js** | No (one-time Puter sign-in) | Free, hosted neural voices via [Puter](https://puter.com) |
| **Google Cloud TTS** | Yes (API key) | ~1M chars/mo Neural2, ~4M chars/mo Standard |
| **Microsoft Azure** | Yes (API key + region) | 500K chars/mo Neural for the first year |
| **ElevenLabs** | Yes (API key) | 10K chars/mo (highest quality) |
| **OpenAI TTS** | Reuses your OpenAI key | Paid only (~$0.015 / 1K chars) |

Each cloud provider's API key is stored only in this browser's `localStorage`, encrypted with the same session-passphrase scheme used for LLM keys. Set or replace narration keys under **⚙ Reading → API keys → Narration keys (optional)**.

## API keys

Each cloud provider prompts for its own API key the first time it is used. The key is stored only in the browser's `localStorage`. Use the small **API KEY** button in the lower-right corner to forget stored keys.

For embedded environments that inject secrets, provide the key before the app script runs or via a `<meta>` tag:

| Provider | Environment variable / meta tag |
|---|---|
| Gemini | `window.GEMINI_API_KEY` or `<meta name="gemini-api-key" content="...">` |
| OpenAI | `window.OPENAI_API_KEY` or `<meta name="openai-api-key" content="...">` |
| Claude | `window.ANTHROPIC_API_KEY` or `<meta name="anthropic-api-key" content="...">` |
| DeepSeek | `window.DEEPSEEK_API_KEY` or `<meta name="deepseek-api-key" content="...">` |
| Qwen | `window.QWEN_API_KEY` or `<meta name="qwen-api-key" content="...">` |
| Kimi | `window.KIMI_API_KEY` or `<meta name="kimi-api-key" content="...">` |
| ERNIE | `window.ERNIE_API_KEY` or `<meta name="ernie-api-key" content="...">` |
| Mistral | `window.MISTRAL_API_KEY` or `<meta name="mistral-api-key" content="...">` |
| Groq | `window.GROQ_API_KEY` or `<meta name="groq-api-key" content="...">` |
| OpenRouter | `window.OPENROUTER_API_KEY` or `<meta name="openrouter-api-key" content="...">` |
| Cerebras | `window.CEREBRAS_API_KEY` or `<meta name="cerebras-api-key" content="...">` |
| Local LLM | `window.LOCAL_LLM_API_KEY` or `<meta name="local-llm-api-key" content="...">` (optional) |

## Local LLM setup

The **Local LLM** provider connects to any server that exposes an OpenAI-compatible `/chat/completions` endpoint — [Ollama](https://ollama.com), [LM Studio](https://lmstudio.ai), [llama.cpp](https://github.com/ggerganov/llama.cpp), Jan, etc.

In **⚙ Settings → API keys → Local LLM**:
1. Paste your endpoint URL (default: `http://localhost:11434/v1/chat/completions`).
2. Optionally add a bearer token if your server requires authentication.
3. In the engine selector, pick **Local LLM** and choose a preset model name or type a custom one matching what you have loaded.

### Ollama quick start

```bash
# Install and pull a model
ollama pull llama3.2

# Start with browser CORS access enabled
OLLAMA_ORIGINS="*" ollama serve
```

Then open the app and point the Local LLM endpoint at `http://localhost:11434/v1/chat/completions` with model `llama3.2`.

### LM Studio

Start the local server from the **Developer** tab. The endpoint is typically `http://localhost:1234/v1/chat/completions`. No bearer token is needed by default.

### llama.cpp server

```bash
llama-server -m your-model.gguf --host 0.0.0.0 --port 8080
```

Endpoint: `http://localhost:8080/v1/chat/completions`.

### CORS note

Browsers block cross-origin requests unless the server explicitly allows them. Most local servers need to be told to allow the origin serving `index.html`:

- **Ollama**: set `OLLAMA_ORIGINS=*` (or the specific origin) before starting.
- **LM Studio**: enable CORS in the server settings panel.
- **llama.cpp**: pass `--cors-origins "*"` to `llama-server`.

## Provider adapters

`src/llm/providers.js` keeps a small `PROVIDERS` registry. Each provider supplies a request builder, a usage logger, and a response extractor. For the opener and GM-logic roles the app forces the model to return structured output; the mechanism varies by provider:

- **Claude** — Anthropic Messages API; the GM schema is sent as a tool with `tool_choice` set to force the exact tool call on in-fiction turns.
- **Gemini** — `generateContent` with `responseMimeType: "application/json"` and `responseJsonSchema` for in-fiction turns.
- **OpenAI** — Responses API with `text.format.type = json_schema` for in-fiction turns.
- **Mistral / Qwen / DeepSeek / Kimi / Groq / OpenRouter / Cerebras** — OpenAI-compatible `chat/completions` with native function calling (`tools` + `tool_choice`) for in-fiction turns, which gives the same hard enforcement as the Anthropic path.
- **ERNIE / Local LLM** — OpenAI-compatible `chat/completions` with `response_format: json_object` and inline schema injection. These providers are available for the Narration role but not for opener or GM logic.

If a structured response cannot be parsed, the app automatically retries once with a corrective prompt quoting the exact required fields and a higher token budget. When both attempts fail the error screen shows the model name, a diagnostic, and the first/last 200 characters of the raw response alongside a **Copy raw response** button.

The Local LLM endpoint URL is configurable per-session in Settings; no API key is required unless the local server demands one.

## Files

- `index.html` — the Vite shell. The mounted React app is loaded from `src/main.jsx`.
- `src/main.jsx` — boot entry. Installs the `window.storage` shim, imports CSS, mounts `<App/>` inside `<ErrorBoundary/>`.
- `src/App.jsx` — the main App component (kept as one file).
- `src/components/` — `TitleScreen`, `GameScreen`, `ErrorBoundary`, `ErrorRawDetail`, `TypewriterText`, modals.
- `src/settings/` — Settings modal sub-components (engine selectors, TTS row, ambience row, API key rows, etc.).
- `src/llm/` — provider registry, GM tool schemas, system-prompt builders, parse/repair helpers.
- `src/tts/` — five TTS adapter modules (browser, puter, openai, voxtral, elevenlabs), provider catalogue, controller.
- `src/ambience/` — Web Audio AmbienceEngine and the scene/event recipe tables.
- `src/data/` — premises, languages, runtime constants.
- `src/storage/` — `window.storage` localStorage fallback shim and the AES-GCM encryption helpers for stored API keys.
- `src/styles/theme.css` — the original literary stylesheet (Cinzel/Cormorant fonts, twilight palette, grain/vignette).
- `dist/` — `npm run build` output (deployed to Pages).
- `.github/workflows/pages.yml` — GitHub Pages deployment workflow (builds with Node 20 and deploys `dist/` on push to `main`).
