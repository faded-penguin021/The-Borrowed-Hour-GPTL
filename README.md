# The Borrowed Hour — Standalone Artifact

This repository contains a single standalone HTML port of the Claude Artifact version of **The Borrowed Hour**, a literary interactive text adventure with built-in scenarios and a custom "Wild" mode.

The OpenAI, Gemini, and Claude builds that used to live in three separate files have been merged into one `index.html`. The API provider and the models are now chosen at runtime from the Settings panel.

## Run

Open `index.html` in a modern browser, or serve the repository directory locally:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/index.html>.

## Choosing engines

Open **⚙ Settings** from the title screen and find the **Story engines** section. Two engines are configured independently:

- **Opening scene** — the model that writes the voice-setting first turn.
- **Continuation & discussion** — the model that handles every later turn and post-game discussion.

For each engine you pick a provider and a model. Any combination is allowed, including a different provider for each engine. Each provider's preset models appear in the dropdown; choose **Custom…** to type any model ID by hand. Your selections are saved in the browser between sessions.

### Preferred defaults

The original two-model architecture pairs a fuller model on the voice-setting opening with a lower-cost model on the repeated continuation loop. The defaults are:

- Opening: Gemini `gemini-3.5-flash`
- Continuation & discussion: Gemini `gemini-flash-lite-latest`

### Preset model lists

| Provider | Models |
|---|---|
| **OpenAI** | `gpt-5.4-mini`, `gpt-5-mini`, `gpt-5.4-nano` |
| **Gemini** | `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest` |
| **Claude** | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **DeepSeek** | `deepseek-chat`, `deepseek-reasoner` |
| **Qwen** | `qwen-max`, `qwen-plus`, `qwen-turbo` |
| **Kimi** | `kimi-k2-0905-preview`, `moonshot-v1-32k`, `moonshot-v1-8k` |
| **ERNIE** | `ernie-4.5-turbo-128k`, `ernie-4.5-turbo-32k`, `ernie-x1-turbo-32k` |
| **Local LLM** | `llama3.2`, `llama3.1`, `mistral`, `phi3`, `qwen2.5`, `gemma3` (or any custom ID) |

## API keys

Each cloud provider prompts for its own API key the first time it is used. The key is stored only in the browser's `localStorage`. Use the small **API KEY** button in the lower-right corner to forget stored keys.

For embedded environments that inject secrets, provide the key before the app script runs or via a `<meta>` tag:

| Provider | Environment variable / meta tag |
|---|---|
| OpenAI | `window.OPENAI_API_KEY` or `<meta name="openai-api-key" content="...">` |
| Gemini | `window.GEMINI_API_KEY` or `<meta name="gemini-api-key" content="...">` |
| Claude | `window.ANTHROPIC_API_KEY` or `<meta name="anthropic-api-key" content="...">` |
| DeepSeek | `window.DEEPSEEK_API_KEY` or `<meta name="deepseek-api-key" content="...">` |
| Qwen | `window.QWEN_API_KEY` or `<meta name="qwen-api-key" content="...">` |
| Kimi | `window.KIMI_API_KEY` or `<meta name="kimi-api-key" content="...">` |
| ERNIE | `window.ERNIE_API_KEY` or `<meta name="ernie-api-key" content="...">` |
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
- **DeepSeek / Kimi / ERNIE** — OpenAI-compatible `chat/completions` with `response_format: json_object` and inline schema injection for in-fiction turns.
- **Qwen** — OpenAI-compatible `chat/completions` with `response_format: json_schema` (DashScope supports full schema).
- **Local LLM** — Same `chat/completions` adapter as the Chinese providers. Endpoint URL is configurable per-session in Settings. No API key is required unless the local server demands one.

## Files

- `index.html` — the unified standalone artifact implementation.
- `the_borrowed_hour (17).txt` — the original Claude Artifact source used as the porting reference.
