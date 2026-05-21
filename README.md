# The Borrowed Hour — Standalone Artifact

This repository contains a single standalone HTML port of the Claude Artifact version of **The Borrowed Hour**, a literary interactive text adventure with built-in scenarios and a custom "Wild" mode.

Earlier per-provider builds have been merged into a single `index.html`. The API provider and models are chosen at runtime from the Settings panel — twelve providers are supported, from major cloud APIs to a local LLM endpoint.

## Run

Open `index.html` in a modern browser, or serve the repository directory locally:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/index.html>.

Pushes to `main` also publish the app to GitHub Pages via `.github/workflows/pages.yml`.

## Choosing engines

Open **⚙ Settings** from the title screen and find the **Story engines** section. Three separate models handle distinct roles:

- **Opening scene** — writes the voice-setting first turn.
- **GM logic** — the hidden rules layer; adjudicates actions and updates game state.
- **Narration & discussion** — renders player-facing prose each turn and post-game discussion.

Pick a **Model stack** to fill all three roles from one provider's preset at once. Enable **Free model selection** to override the stack and choose a provider and model for each role independently — you can mix providers across roles or enter a custom model ID. Selections are saved in the browser between sessions.

### Default stack

The default **Gemini** stack pairs a fuller model on the one-off opening with a lighter model on the repeated loop:

| Role | Default |
|---|---|
| Opening scene | Gemini `gemini-3.5-flash` |
| GM logic | Gemini `gemma-4-31b-it` |
| Narration & discussion | Gemini `gemma-4-31b-it` |

A dedicated **Free (OpenRouter · DeepSeek)** stack routes all three roles through OpenRouter's free `deepseek/deepseek-v4-flash:free`.

### Preset model lists

| Provider | Models |
|---|---|
| **Gemini** | `gemini-3.5-flash`, `gemma-4-31b-it` |
| **OpenAI** | `gpt-5.4-mini`, `gpt-5-mini`, `gpt-5.4-nano` |
| **Claude** | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **DeepSeek** | `deepseek-v4-flash` |
| **Qwen** | `qwen-max`, `qwen-plus`, `qwen-flash` |
| **Kimi** | `kimi-k2.5` |
| **ERNIE** | `ernie-4.5-turbo-128k`, `ernie-4.5-turbo-32k`, `ernie-x1-turbo-32k` |
| **Mistral** | `mistral-large-latest`, `mistral-small-latest`, `open-mistral-nemo` |
| **Groq** | `meta-llama/llama-4-scout-17b-16e-instruct`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `qwen/qwen3-32b` |
| **OpenRouter** | `deepseek/deepseek-v4-flash:free`, `z-ai/glm-4.5-air:free`, `google/gemma-4-31b-it:free`, `anthropic/claude-sonnet-4-6`, `openai/gpt-5.4-mini` |
| **Cerebras** | `llama-3.3-70b`, `gpt-oss-120b`, `qwen-3-32b` |
| **Local LLM** | `llama3.2`, `llama3.1`, `mistral`, `phi3`, `qwen2.5`, `gemma3` (or any custom ID) |

### Free-tier notes

Each GM turn sends a large request — system prompt, tool schema, and the rolling chronicle history. Free tiers differ in how much they allow per request:

- **OpenRouter** and **Gemini** have the most per-request headroom and are the most reliable free options; both still cap total requests per day.
- **Groq** rejects any single request larger than the model's per-minute token budget. The Groq stack defaults to `meta-llama/llama-4-scout-17b-16e-instruct`, which has the most headroom; very long sessions can still hit the limit.
- **Cerebras**' free tier caps context at 8,192 tokens — too small for a GM turn — so Cerebras needs a paid tier here.

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

`index.html` keeps a small `PROVIDERS` registry. Each provider supplies a request builder, a usage logger, and a response extractor:

- **OpenAI** — Responses API with structured JSON output for in-fiction turns. Prompt caching is automatic and prefix-based.
- **Gemini** — `generateContent` with `responseMimeType: "application/json"` and `responseJsonSchema` for in-fiction turns.
- **Claude** — Anthropic Messages API; the GM schema is sent as a tool with `tool_choice` forcing the tool call on in-fiction turns.
- **Qwen / Mistral** — OpenAI-compatible `chat/completions` with `response_format: json_schema` (full schema supported).
- **DeepSeek / Kimi / ERNIE / Groq / OpenRouter / Cerebras / Local LLM** — OpenAI-compatible `chat/completions` with `response_format: json_object` and inline schema injection for in-fiction turns.

The Local LLM endpoint URL is configurable per-session in Settings; no API key is required unless the local server demands one.

## Files

- `index.html` — the unified standalone artifact implementation.
- `the_borrowed_hour (17).txt` — the original Claude Artifact source used as the porting reference.
- `.github/workflows/pages.yml` — GitHub Pages deployment workflow (deploys on push to `main`).
