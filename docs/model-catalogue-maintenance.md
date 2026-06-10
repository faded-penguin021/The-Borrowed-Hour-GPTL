# Model catalogue maintenance

Keeps the three model catalogues current without hand-checking every provider.
Each is a `Record<provider, { …, models: [{ id, tier }] }>` with a default pick,
and each carries a `// checked: YYYY-MM-DD` stamp recording its last refresh:

| Catalogue | File | Default that must resolve to a listed `id` |
|---|---|---|
| LLM (text) | `src/llm/providers.ts` → `PROVIDER_META` | `FREE_MODELS_BY_PROVIDER` opener/gm/narrator |
| Image | `src/llm/imaging.ts` → `IMAGE_PROVIDER_META` | each provider's `defaultModel` |
| TTS | `src/tts/catalogue.ts` → `TTS_PROVIDER_META` | each provider's `model` (also curate `voices`) |

Each "default must resolve to a listed id" invariant is enforced by a test
(`providers.test.ts`, `imaging-catalogue.test.ts`, `tts-catalogue.test.ts`) — the
thing an automated refresh is most likely to break. None of this ships in the
browser bundle; it's maintenance tooling.

## The detector

`npm run check:models` reports:

- **staleness** for all three catalogues (age of each `// checked:` stamp).
- for the **LLM catalogue only**, cross-checked against OpenRouter's public model
  list (no key): **dead ids** in your `openrouter` entry (exact; these 404 — exit
  code 1) and **new free candidates** OpenRouter lists that you don't reference
  (`--all` adds paid; hints only — a provider's native id may differ from the
  OpenRouter slug, so confirm before pasting).

`-- --json` for machine output. Exit codes: `0` clean · `1` dead ids · `2`
couldn't reach OpenRouter. OpenRouter is a text-LLM router — it does **not** list
image or TTS models, so those are staleness-only here and refresh via provider
endpoints (below).

## Refresh procedure (the scheduled session follows this)

1. `npm ci` (honor the lockfile — CLAUDE.md supply-chain rules), then
   `npm run check:models -- --all`.
2. **LLM catalogue** (`providers.ts`). Act on the detector's dead ids / candidates,
   then confirm native ids and the providers OpenRouter can't see (kimi, ernie,
   cerebras, groq, local) via web search:
   - Gemini ai.google.dev · OpenAI platform.openai.com/docs/models · Anthropic
     platform.claude.com · DeepSeek api-docs.deepseek.com · Qwen (DashScope) ·
     Kimi platform.moonshot.cn · ERNIE cloud.baidu.com/qianfan · Mistral
     docs.mistral.ai · Groq console.groq.com/docs/models · Cerebras
     inference.cerebras.ai (mind the small free-tier context — too small here)
3. **Image catalogue** (`imaging.ts` → `IMAGE_PROVIDER_META`). Refresh each provider
   from its own endpoint/docs, keeping `defaultModel` pointed at a listed id:
   - Pollinations — image.pollinations.ai/models
   - Replicate — replicate.com (black-forest-labs/* flux versions) or `/v1/models`
   - OpenAI image — platform.openai.com/docs/models (gpt-image family); add retired
     ids to `DEPRECATED_OPENAI_IMAGE_MODELS` so stale saved configs upgrade silently
   - Local — leave as is
4. **TTS catalogue** (`catalogue.ts` → `TTS_PROVIDER_META`). Refresh `models` and the
   curated `voices` subset, keeping `model` pointed at a listed id:
   - OpenAI — `/v1/models` (tts-*, gpt-4o-*-tts) + the voice list in its docs
   - ElevenLabs — `GET /v1/models` and `GET /v1/voices`
   - Voxtral (Mistral) — `GET /v1/audio/voices` (the adapter already fetches this live)
   - Azure / Google — voices.list endpoints; keep the tasteful subset, don't dump
5. **Curate, don't dump.** Per provider keep a focused set: current mid/low-tier
   workhorses plus the flagship. Drop retired ids. Set a free tier only when the
   provider genuinely serves it free with enough context/quota.
6. Bump the `// checked:` stamp to today in whichever catalogue(s) you touched.
7. `npm run check && npm test` — the guardrail tests catch default↔list drift.
8. Open a PR. **Never auto-merge.**

## Guardrails

- Edit only the catalogue file(s): `src/llm/providers.ts`, `src/llm/imaging.ts`,
  `src/tts/catalogue.ts`. If `package.json` / `package-lock.json` appear in the
  diff, **stop** — that's a CLAUDE.md tripwire and this task adds no dependencies.
- A genuinely new provider (new outbound origin) also needs a `connect-src` entry
  in `index.html`'s CSP and an adapter — a bigger change; flag it, don't slip it
  into a routine refresh.
- Keep edits surgical; match the surrounding style.

## PR template

```
Title: chore: refresh model catalogues (YYYY-MM-DD)

- <catalogue>/<provider>: added / removed / re-tiered / default swaps, with the
  source (OpenRouter or a provider-docs URL) for each non-obvious id
- npm run check + npm test green
- no dependency changes
```

## Scheduling it (one-time, in the web UI)

Configure a Claude Code on the web scheduled trigger against this repo — weekly is
plenty. Point it at this runbook with a prompt like:

```
Refresh the model catalogues. Follow docs/model-catalogue-maintenance.md exactly:
run `npm run check:models -- --all`, refresh the LLM / image / TTS catalogues
(OpenRouter + provider endpoints + web search), keep each default resolving to a
listed id, bump the `// checked:` stamps you touch, run `npm run check && npm test`,
then open a PR. Do not auto-merge. If nothing material changed, exit without a PR.
```

The trigger itself is created in the web UI (you turn it on) — see
https://code.claude.com/docs/en/claude-code-on-the-web.
