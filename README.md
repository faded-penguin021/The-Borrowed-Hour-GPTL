# The Borrowed Hour — Standalone Artifact

This repository contains a single standalone HTML port of the Claude Artifact version of **The Borrowed Hour**, a literary interactive text adventure with built-in scenarios and a custom “Wild” mode.

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

For each engine you pick a provider (OpenAI, Gemini, or Claude) and a model. Any combination is allowed, including a different provider for each engine — for example a Gemini Flash-Lite opening with a Claude Sonnet continuation. Each provider's preset models appear in the dropdown; choose **Custom…** to type any model ID by hand. Your selections are saved in the browser between sessions.

### Preferred defaults

The original two-model architecture pairs a fuller model on the voice-setting opening with a lower-cost model on the repeated continuation loop. The defaults are:

- Opening: Gemini `gemini-3.5-flash`
- Continuation & discussion: Gemini `gemini-flash-lite-latest`

The preset model lists are:

- **OpenAI** — `gpt-5.4-mini`, `gpt-5-mini`, `gpt-5.4-nano`
- **Gemini** — `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`
- **Claude** — `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

## API keys

Each provider prompts for its own API key the first time it is used. The key is stored only in the browser's `localStorage`. Use the small **API KEY** button in the lower-right corner to forget the stored key(s) for whichever providers the current engines use.

For embedded environments that inject secrets, provide the key before the app script runs or via a `<meta>` tag:

- OpenAI: `window.OPENAI_API_KEY` or `<meta name="openai-api-key" content="...">`
- Gemini: `window.GEMINI_API_KEY` or `<meta name="gemini-api-key" content="...">`
- Claude: `window.ANTHROPIC_API_KEY` or `<meta name="anthropic-api-key" content="...">`

## Provider adapters

`index.html` keeps a small `PROVIDERS` registry. Each provider supplies a request builder, a usage logger, and a response extractor:

- **OpenAI** — Responses API with structured JSON output for in-fiction turns. Anthropic-style cache-control markers are omitted because OpenAI prompt caching is automatic and prefix-based.
- **Gemini** — `generateContent` with `responseMimeType: "application/json"` and `responseJsonSchema` for in-fiction turns.
- **Claude** — Anthropic Messages API; the GM schema is sent as a tool with `tool_choice` forcing the tool call on in-fiction turns.

## Files

- `index.html` — the unified standalone artifact implementation.
- `the_borrowed_hour (17).txt` — the original Claude Artifact source used as the porting reference.
