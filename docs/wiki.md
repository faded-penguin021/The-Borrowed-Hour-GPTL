# The Borrowed Hour wiki notes

These notes preserve the longer operational and architecture reference material that used to live in the README. Keep the root README focused on what the project is and how to run it; expand this document for provider details, implementation notes, and maintenance references.

A literary interactive text adventure with built-in scenarios and a custom "Wild" mode. The API provider and models are chosen at runtime from the Settings panel — twelve providers are supported, from major cloud APIs to a local LLM endpoint.

Originally a single-file HTML artifact; now a small Vite + React + Tailwind project. `src/App.tsx` is now a thin top-level shell that wires up the provider tree; the turn pipeline lives in `src/context/` (`gameLoop.ts`, `storyReducer.ts`, `GameContext.tsx`), and peripheral components, data, LLM adapters, TTS adapters, and the ambience engine are split into their own modules under `src/`.

## Run

### Development

```bash
npm ci
npm run dev
```

Then visit <http://localhost:5173>.

### Production build

```bash
npm run build
```

The built site is written to `dist/`. Preview it locally with `npm run preview`.

Pushes to `main` build and publish the app to GitHub Pages via `.github/workflows/pages.yml`.

## Install as an app (PWA)

The Borrowed Hour is a Progressive Web App. On a supported browser you can install it to the home screen / dock (Chrome and Edge show an install icon in the address bar; iOS Safari uses **Share → Add to Home Screen**). Installed, it launches in a standalone window with its own hourglass icon and the twilight theme colour.

A small service worker (`public/sw.js`) exists solely to satisfy the browser's install criteria; it does **not** add offline support. The game cannot run without the network (the LLM, image, and TTS providers are all remote), so an offline "shell" would be the theme with no gameplay — we deliberately don't ship that. The worker is an inert pass-through: it caches nothing and leaves every request to the network. It registers in production builds only — `npm run dev` is left to Vite's HMR.

App icons are generated, dependency-free, from `scripts/gen-icons.mjs` (`npm run gen:icons`) and committed under `public/`. Re-run that script after editing the icon design.

## Choosing engines

Open **⚙ Settings** from the title screen and find the **Story engines** section. Three separate models handle distinct roles:

- **Opening scene** — writes the voice-setting first turn.
- **GM logic** — the hidden rules layer; adjudicates actions and updates game state.
- **Narration & discussion** — renders player-facing prose each turn and post-game discussion.

Pick a **Model stack** to fill all three roles from one provider's preset at once. Enable **Free model selection** to override the stack and choose a provider and model for each role independently — you can mix providers across roles or enter a custom model ID. Free model selection also covers the **image provider model**, **Art Director model**, and **TTS model**, each of which exposes a preset list plus a Custom… option for any model ID. Selections are saved in the browser between sessions.

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
| **Gemini** | `gemini-3.5-flash`, `gemini-3.1-flash-lite` |
| **OpenAI** | `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano` |
| **Claude** | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **DeepSeek** | `deepseek-v4-flash`, `deepseek-v4-pro` |
| **Qwen** | `qwen3.7-plus`, `qwen3.6-flash`, `qwen-plus`, `qwen-flash` |
| **Kimi** | `kimi-k2.7-code`, `kimi-k2.6`, `kimi-k2.5` |
| **ERNIE** | `ernie-5.1`, `ernie-4.5-turbo-128k`, `ernie-4.5-turbo-32k` |
| **Mistral** | `mistral-small-latest`, `mistral-medium-latest` (both free), `mistral-large-latest` (free) |
| **Groq** | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`, `qwen/qwen3-32b` |
| **OpenRouter** | `nvidia/nemotron-3-ultra-550b-a55b:free`, `meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-4-31b-it:free`, `anthropic/claude-fable-5`, `openai/gpt-5.4-mini`, `moonshotai/kimi-k2.7-code` |
| **Cerebras** | `gpt-oss-120b`, `gemma-4-31b` |
| **Local LLM** | `llama3.2`, `llama3.1`, `mistral`, `phi3`, `qwen2.5` (or any custom ID) |

### Free-tier notes

Each GM turn sends a large request — system prompt, tool schema, and the rolling chronicle history. Free tiers differ in how much they allow per request and per minute:

- **Mistral** (default) has generous free API access with no per-minute token limits, making it the most reliable free option. Both medium and large models are available on the free tier.
- **Gemini** (`gemini-3.5-flash`) has daily request quotas but no per-minute caps; suitable for casual play but capped at ~20 games/day.
- **Groq** rejects requests larger than the model's per-minute budget. The Groq stack uses `openai/gpt-oss-120b`; `qwen/qwen3.6-27b` is the recommended lighter alternative. Very long sessions can still exceed per-minute limits.
- **Cerebras**' free tier caps context at 8,192 tokens — too small for a GM turn — so paid tier is required here.
- **OpenRouter** free models (`nvidia/nemotron-3-ultra-550b-a55b:free`, `meta-llama/llama-3.3-70b-instruct:free`) have tight per-minute caps and are not recommended for repeated calls.

## Read aloud (text-to-speech)

A narration voice can be enabled from **⚙ Reading → Read aloud (text-to-speech)**. When enabled, a small ♪ Hear button appears under every narration passage and (optionally) each new passage auto-plays as it arrives. A **HUSH** button appears in the header while the narrator is speaking.

Seven providers are supported:

| Provider | Key required? | Free tier |
|---|---|---|
| **Browser (Web Speech)** | No | Free, offline, uses your OS voices |
| **Puter.js** | No (one-time Puter sign-in) | Free, hosted neural voices via [Puter](https://puter.com) |
| **Google Cloud TTS** | Yes (API key) | ~1M chars/mo Neural2, ~4M chars/mo Standard |
| **Microsoft Azure** | Yes (API key + region) | 500K chars/mo Neural for the first year |
| **ElevenLabs** | Yes (API key) | 10K chars/mo (highest quality) |
| **OpenAI TTS** | Reuses your OpenAI key | Paid only (~$0.015 / 1K chars) |
| **Voxtral** | Reuses your Mistral key | Free on Mistral's tier (`voxtral-mini-tts-2603`) |

Each cloud provider's API key is stored only in this browser's `localStorage`, encrypted with the same session-passphrase scheme used for LLM keys. Enter or replace a narration key inline in the **⚙ Reading → Read aloud (text-to-speech)** control when you pick its provider; providers that reuse an LLM key (OpenAI TTS, Voxtral) take it from **⚙ Settings → System → API keys**.

## API keys

Each cloud provider prompts for its own API key the first time it is used. The key is stored only in the browser's `localStorage`. Manage saved keys under **⚙ Settings → System → API keys**, where each provider row has **TEST**, **REPLACE**, and **FORGET** buttons; **FORGET** removes that provider's stored key.

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

In **⚙ Settings → System → API keys → Local LLM**:
1. Paste your endpoint URL (default: `http://localhost:11434/v1/chat/completions`).
2. Optionally add a bearer token if your server requires authentication.
3. In the engine selector, pick **Local LLM** and choose a preset model name or type a custom one matching what you have loaded.

### Ollama quick start

```bash
# Install and pull a model
ollama pull llama3.2

# Start with browser CORS access enabled (use your dev-server origin)
OLLAMA_ORIGINS="http://localhost:5173" ollama serve
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

- **Ollama**: set `OLLAMA_ORIGINS` to your app's origin (e.g. `http://localhost:5173`) before starting.
- **LM Studio**: enable CORS in the server settings panel and add your origin to the allowlist.
- **llama.cpp**: pass `--cors-origins "http://localhost:5173"` to `llama-server`.

## Provider adapters

`src/llm/providers.ts` keeps a small `PROVIDERS` registry. Each provider supplies a request builder, a usage logger, and a response extractor. For the opener and GM-logic roles the app forces the model to return structured output; the mechanism varies by provider:

- **Claude** — Anthropic Messages API; the GM schema is sent as a tool with `tool_choice` set to force the exact tool call on in-fiction turns.
- **Gemini** — `generateContent` with `responseMimeType: "application/json"` and `responseJsonSchema` for in-fiction turns.
- **OpenAI** — Responses API with `text.format.type = json_schema` for in-fiction turns.
- **Mistral / Qwen / DeepSeek / Kimi / Groq / OpenRouter / Cerebras** — OpenAI-compatible `chat/completions` with native function calling (`tools` + `tool_choice`) for in-fiction turns, which gives the same hard enforcement as the Anthropic path.
- **ERNIE / Local LLM** — OpenAI-compatible `chat/completions` with `response_format: json_object` and inline schema injection. These providers are available for the Narration role but not for opener or GM logic.

If a structured response cannot be parsed, the app automatically retries once with a corrective prompt quoting the exact required fields and a higher token budget. When both attempts fail the error screen shows the model name, a diagnostic, and the first/last 200 characters of the raw response alongside a **Copy raw response** button.

The Local LLM endpoint URL is configurable per-session in Settings; no API key is required unless the local server demands one.

## Files

- `index.html` — the Vite shell. The mounted React app is loaded from `src/main.tsx`.
- `src/main.tsx` — boot entry. Installs the `window.storage` shim, imports CSS, mounts `<App/>` inside `<ErrorBoundary/>`.
- `src/App.tsx` — the top-level shell: gates onboarding, wires up the provider tree, and tracks modal open/close state.
- `src/context/` — game state and the turn pipeline (`gameLoop.ts`, `storyReducer.ts`, `GameContext.tsx`), plus the settings, passphrase, ambience, and TTS providers.
- `src/components/` — `TitleScreen`, `GameScreen`, `StreamingNarration`, `ErrorBoundary`, `ErrorRawDetail`, `TypewriterText`, modals.
- `src/settings/` — Settings modal sub-components (engine selectors, TTS row, ambience row, API key rows, etc.).
- `src/llm/` — provider registry, streaming client, GM tool schemas, the art-director image pipeline, parse/repair helpers.
- `src/prompts/` — the system prompt, doctrine, narrator, reveal, and meta prompts; the active prompt is assembled here (don't inline prompt strings elsewhere).
- `src/tts/` — seven TTS adapter modules (browser, puter, openai, voxtral, elevenlabs, azure, google), provider catalogue, controller.
- `src/ambience/` — Web Audio AmbienceEngine and the scene/event recipe tables.
- `src/data/` — premises, languages, realm styles, runtime constants.
- `src/storage/` — `window.storage` localStorage fallback shim and the AES-GCM encryption helpers for stored API keys.
- `src/styles/theme.css` — the original literary stylesheet (Cinzel/Cormorant fonts, twilight palette, grain/vignette).
- `public/` — static assets copied verbatim to the site root: `manifest.webmanifest`, the service worker `sw.js`, `favicon.svg`, and the generated PNG app icons.
- `scripts/gen-icons.mjs` — dependency-free PNG app-icon generator (run via `npm run gen:icons`).
- `dist/` — `npm run build` output (deployed to Pages).
- `.github/workflows/pages.yml` — GitHub Pages deployment workflow (builds with Node 24 and deploys `dist/` on push to `main`).

## Release / update maintenance

Routine upkeep touches three things: the model menus, provider endpoints, and the
locked dependencies. Each has a safe path.

### Bumping models

Per-provider model lists live in `PROVIDER_META` in `src/llm/providers.ts`, one
`models: [...]` array per provider, each entry `{ id, tier }`. To add, remove, or
re-order what the Settings menu offers, edit those arrays — `id` is the exact
string sent to the provider, `tier` (`free` / `paid`) is the menu label only.
There is a `// checked: <date>` marker above `PROVIDER_META`; update it when you
sweep the lists so the next maintainer knows how current they are. No CSP change
is needed for a new model on an already-allowed provider.

### Provider endpoints

Request shaping for every provider is centralized in `src/llm/providers.ts` (new
providers go here, not as siblings). Whenever a provider's requests reach a **new
outbound origin**, add that origin in the same commit to BOTH the `connect-src`
allowlist in the Content-Security-Policy `<meta>` tag in `index.html` AND the
declared manifest in `src/security/origins.ts` — `src/security/origins.test.ts`
fails the suite if the two drift in either direction. (Note: the CSP lives in
`index.html`, not `vite.config.js`.) Keep the local-LLM `http://localhost:*` /
`http://127.0.0.1:*` entries as-is — forcing them to `https` breaks Ollama and
LM Studio. After any endpoint change, smoke-test the affected provider before
shipping.

### Locked dependencies

Dependency changes are a reviewable event — read the supply-chain section of
`CLAUDE.md` first. The short version:

- Use `npm ci` for everything except a deliberate dependency change; only then use
  `npm install`, and commit `package.json` and `package-lock.json` together.
- After an install, confirm the only packages with `hasInstallScript: true` are
  `esbuild` and `fsevents`, and that no unexpected `binding.gyp` appeared.
- CI runs `npm ci` against the committed lockfile on Node 24; don't change that.
