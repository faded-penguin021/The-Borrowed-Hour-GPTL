# The Borrowed Hour — OpenAI Standalone Artifact

This repository contains a single-file HTML port of the Claude Artifact version of **The Borrowed Hour**, a literary interactive text adventure with built-in scenarios and a custom “Wild” mode.

## Run

Open `index.html` in a modern browser, or serve the repository directory locally:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/>.

The app prompts for an OpenAI API key the first time you begin an hour. The key is stored only in the browser’s `localStorage`; use the small **API KEY** button in the lower-right corner to forget it. If you are embedding this file in an environment that injects secrets, you can also provide `window.OPENAI_API_KEY` before the app script runs or add a `<meta name="openai-api-key" content="...">` tag.

## OpenAI model strategy

The port preserves the original two-model architecture:

- Opening scenes use `gpt-5.4`, a mid-tier frontier model, because the opening establishes the voice and world texture for the rest of the hour.
- Continuation turns and post-game meta discussion use `gpt-5.4-mini`, a lower-cost model that inherits the established voice while keeping repeated turns less expensive.

The original Anthropic `tool_choice` flow has been adapted to OpenAI’s Responses API with structured JSON output for in-fiction turns. Anthropic-specific cache-control markers are omitted because OpenAI prompt caching is automatic and prefix-based rather than requested with per-message cache-control blocks.

## Files

- `index.html` — the standalone OpenAI Artifact implementation.
- `the_borrowed_hour (17).txt` — the original Claude Artifact source used as the porting reference.
