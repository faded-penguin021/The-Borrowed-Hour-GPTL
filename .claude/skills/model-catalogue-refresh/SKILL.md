---
name: model-catalogue-refresh
description: Refresh the three model catalogues (LLM, image, TTS) against provider endpoints and OpenRouter, keeping each default resolvable and each `// checked:` stamp current. Use for the weekly scheduled catalogue-refresh session, or whenever asked to update, refresh, or check the model catalogues / provider model lists. Executable companion to docs/model-catalogue-maintenance.md.
---

# Model catalogue refresh

Executable steps for refreshing the model catalogues. `docs/model-catalogue-maintenance.md`
is the rationale/reference; this skill is the procedure. If the two drift, that is a
defect — fix whichever is wrong.

## The three catalogues

| Catalogue | File | Default that must resolve to a listed `id` |
|---|---|---|
| LLM (text) | `src/llm/providers.ts` → `PROVIDER_META` | `FREE_MODELS_BY_PROVIDER` opener/gm/narrator |
| Image | `src/llm/imaging.ts` → `IMAGE_PROVIDER_META` | each provider's `defaultModel` |
| TTS | `src/tts/catalogue.ts` → `TTS_PROVIDER_META` | each provider's `model` (also curate `voices`) |

Each carries a `// checked: YYYY-MM-DD` stamp. The "default resolves to a listed id"
invariant is enforced by `providers.test.ts`, `imaging-catalogue.test.ts`, and
`tts-catalogue.test.ts` — the thing a refresh is most likely to break.

## Steps

1. `npm ci` (honor the lockfile — CLAUDE.md supply-chain rules), then
   `npm run check:models -- --all`. The detector reports staleness for all three
   catalogues and, for the LLM catalogue only, dead ids (exit 1) and new free
   candidates cross-checked against OpenRouter (`--all` adds paid; hints only —
   a native id may differ from the OpenRouter slug, so confirm before pasting).
   Exit codes: `0` clean · `1` dead ids · `2` couldn't reach OpenRouter.

2. **LLM catalogue** (`src/llm/providers.ts`). Act on the detector's dead ids /
   candidates, then confirm native ids and the providers OpenRouter can't see
   (kimi, ernie, cerebras, groq, local) via web search:
   - Gemini ai.google.dev · OpenAI platform.openai.com/docs/models · Anthropic
     platform.claude.com · DeepSeek api-docs.deepseek.com · Qwen (DashScope) ·
     Kimi platform.moonshot.cn · ERNIE cloud.baidu.com/qianfan · Mistral
     docs.mistral.ai · Groq console.groq.com/docs/models · Cerebras
     inference.cerebras.ai (its free-tier context is too small — skip here).

3. **Image catalogue** (`src/llm/imaging.ts` → `IMAGE_PROVIDER_META`). Refresh each
   provider from its own endpoint/docs, keeping `defaultModel` pointed at a listed id:
   - Pollinations — image.pollinations.ai/models
   - Replicate — replicate.com (the black-forest-labs/* image family) or `/v1/models`
   - OpenAI image — platform.openai.com/docs/models (the current image-model family);
     add retired ids to `DEPRECATED_OPENAI_IMAGE_MODELS` so stale saved configs
     upgrade silently
   - Local — leave as is

4. **TTS catalogue** (`src/tts/catalogue.ts` → `TTS_PROVIDER_META`). Refresh `models`
   and the curated `voices` subset, keeping `model` pointed at a listed id:
   - OpenAI — `/v1/models` (the current text-to-speech models) + the voice list in its docs
   - ElevenLabs — `GET /v1/models` and `GET /v1/voices`
   - Voxtral (Mistral) — `GET /v1/audio/voices` (the adapter already fetches this live)
   - Azure / Google — voices.list endpoints; keep the tasteful subset, don't dump

5. **Curate, don't dump.** Per provider keep a focused set: current mid/low-tier
   workhorses plus the flagship. Drop retired ids. Set a free tier only when the
   provider genuinely serves it free with enough context/quota.

6. Bump the `// checked:` stamp to today in whichever catalogue(s) you touched.

7. Sweep `docs/wiki.md` for references to model ids you renamed or removed (the
   free-tier table names concrete ids, e.g. the Voxtral TTS model). Fix only what
   the refresh stranded.

8. `npm run ladder` — supply-chain guard, typecheck, lint, tests (the guardrail
   tests catch default↔list drift), build. Coverage runs with the tests; catalogue
   data is imported by its tests, so a refresh should be coverage-neutral. If
   thresholds still trip on a data-only change, **stop and report instead of
   chasing coverage**.

9. Material changes → open a PR. **Never auto-merge.** Nothing material (stamps
   would be the only diff) → exit without a PR.

## Guardrails

- Edit only the catalogue file(s) — `src/llm/providers.ts`, `src/llm/imaging.ts`,
  `src/tts/catalogue.ts` — plus `docs/wiki.md` when step 7 strands a reference. If
  `package.json` / `package-lock.json` appear in the diff, **stop** — that's a
  CLAUDE.md tripwire and this task adds no dependencies.
- A genuinely new provider (new outbound origin) also needs a `connect-src` entry
  in `index.html`'s CSP **and** a matching line in `src/security/origins.ts`
  (`origins.test.ts` fails on drift), plus an adapter — a bigger change; flag it,
  don't slip it into a routine refresh.
- Keep edits surgical; match the surrounding style.

## PR template

```
Title: chore: refresh model catalogues (YYYY-MM-DD)

- <catalogue>/<provider>: added / removed / re-tiered / default swaps, with the
  source (OpenRouter or a provider-docs URL) for each non-obvious id
- npm run ladder green
- no dependency changes
```
