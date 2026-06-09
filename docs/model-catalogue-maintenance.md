# Model catalogue maintenance

Keeps the provider/model lists in `src/llm/providers.ts` current without
hand-checking every provider. Two surfaces, kept in sync:

- **`PROVIDER_META[*].models`** — the presets the model picker offers, each with
  a `tier` (`free` | `paid`).
- **`FREE_MODELS_BY_PROVIDER`** — the default opener / gm / narrator pick per
  provider. Every id here must exist in that provider's `models`
  (enforced by `src/__tests__/providers.test.ts`).

A `// checked: YYYY-MM-DD` comment above `PROVIDER_META` records the last
refresh. None of this ships in the browser bundle — it's maintenance tooling.

## The detector

`npm run check:models` cross-checks the committed catalogue against OpenRouter's
**public** model list (no key) and reports:

- **dead ids** — models your `openrouter` entry lists that OpenRouter no longer
  serves (exact; these 404 at runtime). Exit code `1` if any.
- **new free candidates** — models OpenRouter now lists for vendors you support
  that you don't reference (hints; `--all` adds paid).
- **staleness** — age of the `// checked:` date.
- providers OpenRouter doesn't aggregate (kimi, ernie, cerebras, groq, local) —
  confirm those by web search.

`npm run check:models -- --json` emits machine-readable output for the agent.
Exit codes: `0` clean · `1` dead ids found · `2` couldn't reach OpenRouter.

## Refresh procedure (the scheduled session follows this)

1. `npm ci` (honor the lockfile — see CLAUDE.md supply-chain rules), then
   `npm run check:models -- --all`.
2. **Fill the gaps OpenRouter can't see.** For each provider — especially kimi,
   ernie, cerebras, groq, local — and to confirm any candidate's *native* id,
   web-search the provider's current model list / pricing:
   - Gemini — ai.google.dev models + free tier
   - OpenAI — platform.openai.com/docs/models
   - Anthropic — platform.claude.com models overview
   - DeepSeek — api-docs.deepseek.com
   - Qwen (DashScope) — model list + pricing
   - Kimi (Moonshot) — platform.moonshot.cn
   - ERNIE (Qianfan) — cloud.baidu.com/qianfan
   - Mistral — docs.mistral.ai (free tier)
   - Groq — console.groq.com/docs/models
   - Cerebras — inference.cerebras.ai (mind the free-tier context cap — too small here)
   - Local — leave as common Ollama tags
3. **Curate, don't dump.** Per provider keep ~2–4 presets: the current mid/low-tier
   workhorses plus the current flagship. Drop retired ids. Set `tier: "free"` only
   when the provider genuinely serves it free *with enough context for a GM turn*.
4. **Keep the defaults valid.** Update `FREE_MODELS_BY_PROVIDER` so opener/gm/narrator
   reference ids that exist in the new presets (stronger for opener; cheaper/faster
   for gm + narrator).
5. Bump `// checked:` to today.
6. `npm run check && npm test` — the guardrail test catches default↔preset drift.
7. Open a PR. **Never auto-merge.**

## Guardrails

- Edit only `src/llm/providers.ts` (plus this doc's `checked:` date lives there).
  If `package.json` / `package-lock.json` appear in the diff, **stop** — that's a
  CLAUDE.md tripwire and this task adds no dependencies.
- A genuinely new provider (new outbound origin) also needs a `connect-src` entry
  in `index.html`'s CSP and an adapter in `providers.ts` — a bigger change; flag
  it, don't slip it into a routine refresh.
- Keep edits surgical; match the surrounding style.

## PR template

```
Title: chore: refresh model catalogue (YYYY-MM-DD)

- <provider>: added / removed / re-tiered / default swaps, with the source
  (OpenRouter or a provider-docs URL) for each non-obvious id
- npm run check + npm test green
- no dependency changes
```

## Scheduling it (one-time, in the web UI)

Configure a Claude Code on the web scheduled trigger against this repo — weekly
is plenty. Point it at this runbook with a prompt like:

```
Refresh the model catalogue. Follow docs/model-catalogue-maintenance.md exactly:
run `npm run check:models -- --all`, fill provider gaps via web search, curate
PROVIDER_META + FREE_MODELS_BY_PROVIDER, bump the `// checked:` date, run
`npm run check && npm test`, then open a PR. Do not auto-merge. If nothing
material changed, exit without opening a PR.
```

The trigger itself is created in the web UI (you turn it on) — see
https://code.claude.com/docs/en/claude-code-on-the-web.
