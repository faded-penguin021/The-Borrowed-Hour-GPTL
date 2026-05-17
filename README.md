# The Borrowed Hour — Standalone Artifacts

This repository contains standalone HTML ports of the Claude Artifact version of **The Borrowed Hour**, a literary interactive text adventure with built-in scenarios and a custom “Wild” mode.

## Run

Open either standalone file in a modern browser, or serve the repository directory locally:

```bash
python -m http.server 8000
```

Then visit one of:

- <http://localhost:8000/index.html> for the OpenAI version.
- <http://localhost:8000/gemini.html> for the Gemini version.

Both versions prompt for a provider API key the first time you begin an hour. The key is stored only in the browser’s `localStorage`; use the small **API KEY** button in the lower-right corner to forget it.

For embedded environments that inject secrets:

- OpenAI: provide `window.OPENAI_API_KEY` before the app script runs or add a `<meta name="openai-api-key" content="...">` tag.
- Gemini: provide `window.GEMINI_API_KEY` before the app script runs or add a `<meta name="gemini-api-key" content="...">` tag.

## Model strategies

Both ports preserve the original two-model architecture: a stronger/fuller model writes the opening scene because it establishes the hour’s voice and texture, while a lower-cost model handles continuations and post-game discussion.

### OpenAI version (`index.html`)

- Opening scenes use `gpt-5.4-mini`, keeping the strongest mini model on the voice-setting turn without paying full frontier-model prices.
- Continuation turns and post-game meta discussion use `gpt-5-mini`, a cheaper near-frontier model for the repeated turn loop.
- `gpt-5.4-nano` is cheaper still, but this port avoids it by default because the chronicle needs literary prose and stateful scene judgment rather than simple high-volume extraction/classification behavior.
- The original Anthropic `tool_choice` flow is adapted to OpenAI’s Responses API with structured JSON output for in-fiction turns. Anthropic-specific cache-control markers are omitted because OpenAI prompt caching is automatic and prefix-based rather than requested with per-message cache-control blocks.

### Gemini version (`gemini.html`)

- Opening scenes use `gemini-2.5-pro`.
- Continuation turns and post-game meta discussion use `gemini-3-flash-preview`.
- The same GM schema is sent to Gemini `generateContent` with `responseMimeType: "application/json"` and `responseJsonSchema` for in-fiction turns.
- The Gemini prompt has a provider-specific length guard: openings target 350–500 words and continuations target 180–320 words so Flash does not collapse turns into terse summaries.

## Files

- `index.html` — the standalone OpenAI artifact implementation.
- `gemini.html` — the standalone Gemini artifact implementation.
- `the_borrowed_hour (17).txt` — the original Claude Artifact source used as the porting reference.
