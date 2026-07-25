# STATE — project state & session memory

> **Length guard (read before editing).** Steady-state target ≤ 8 KB. **If this
> file exceeds 16 KB, aggressively compress before committing:** collapse each
> completed unit into one Changelog line, delete narrative prose, and push
> durable detail down to git history + `docs/BACKLOG.md`. The **Project**,
> **Current state**, and **Owner queue** sections must always survive
> compression (Owner-queue items are the owner's to close — compress their
> prose, never drop an open item). `scripts/ladder.sh` machine-checks this:
> warn > 8 KB, fail > 16 KB.

## Project

The Borrowed Hour — a fully client-side, single-page literary text adventure.
No backend: players bring their own API keys and the browser talks straight to
LLM / image / TTS providers. Vite 8 + React 19 + TypeScript (strict), Tailwind 4,
Vitest (unit) + Playwright (e2e), ESLint 10, Node 24 in CI. Shipped and deployed
to GitHub Pages from `main` (`.github/workflows/pages.yml`).

## Current state

**Shipped and in maintenance.** The 2026-07 audit + hardening pass (units U0–B7,
follow-ups F1–F2) and the improvement phase (H / T / E / P) are all `done` —
`docs/BACKLOG.md` is the full record, git history is the detail. The maintenance
harness (STATE.md, `scripts/ladder.sh`, session discipline, deny rails) shipped
in #208. No active multi-unit work.

Active branch `claude/deps-eslint-majors`: takes the two coupled Dependabot
eslint majors together — eslint 9→10 and eslint-plugin-react-hooks 5→7 (eslint
10 can't install under the plugin's old peer cap; the plugin's v7 `recommended`
adds new erroring rules). `eslint.config.js` now pins the two classic react-hooks
rules explicitly instead of spreading `recommended`, so the lint surface is
unchanged and no behavior-sensitive refactor is forced by the bump.

Standing harness: **AMH v1.8, partially adopted** — gap analysis, staged
segments 2–4 and owner forks in `docs/plans/amh-v1.8-adoption.md`. Plus
`scripts/check-supply-chain.mjs` (the `guard`), `.claude/` SessionStart hook,
permission rails + `PreToolUse` install rail, `model-catalogue-refresh` skill.

Verification = `scripts/ladder.sh` (supply-chain guard → typecheck → lint →
unit tests + coverage → build). Playwright e2e is **not** in the ladder: it runs
as a separate CI job and locally needs `PW_CHROMIUM` (the SessionStart hook
exports it). On-device / real-provider behavior is owner-verified via the Owner
queue.

## Owner queue

> **Protected section.** Never delete this section or silently drop items during
> compression (items leave only when done / answered / triaged, and the outcome
> is then recorded as a Changelog line). A session's final chat message restates
> this queue.

**Pending owner actions:**
1. **#214 (`@eslint/js` 9→10)** — red only on four `no-useless-assignment`
   findings in our own source. #215 fixes them; once it is on `main`, #214 goes
   green on its next rebase and merges as-is. (The 2026-07-18 eslint-majors item
   is closed out — that branch merged, and #204–#207 are all closed.)

2. **#213 (`typescript` 6.0.3→7.0.2) is upstream-blocked** — `typescript-eslint` 8.65.0
   (latest) still declares `peer typescript >=4.8.4 <6.1.0`, so `npm ci` can't
   resolve and no ladder rung runs. Nothing to fix on our side; forcing it with
   `overrides` / `--legacy-peer-deps` is explicitly not the move. Leave the PR
   open and re-check when typescript-eslint ships a TS7-capable major.

3. **Approve (or redirect) `docs/plans/amh-v1.8-adoption.md`** — the staged
   segments 2–4. Plan files are owner-approved by protocol; it is provisional
   until you say otherwise.

**Open questions:** [2026-07-25] five AMH v1.8 forks — each with options and a
recommendation in `docs/plans/amh-v1.8-adoption.md` → Owner forks: (1) v1.8's
fresh-context review protocols contradict this repo's no-subagents rule, and
rule diffs get no self-review fallback, so the shipped Segment 1 itself wants a
human read; (2) adopt `docs/LEDGER.md`, deferred 2026-07-18?; (3) declare the
merge mode; (4) server-side rails (owner-only); (5) STATE thresholds.

**Incoming findings:** (none)

## Decided non-items (don't re-litigate without new evidence)

- **The install rail keeps its `BORROWED_DEP_CHANGE=1` opt-out** (owner,
  2026-07-25) — "in its narrow and well-defined scope": a dependency-change task
  opts in explicitly, keeping intent auditable instead of inviting workarounds.
  Narrow is load-bearing — the prefix exempts only the segment it prefixes, and
  `.claude/hooks/block-npm-install.test.mjs` pins that.

- **No backend of this project's own.** All state lives in the browser; keys go
  straight from browser to provider (users may point at their own BYOB proxy,
  which is theirs, not ours). Architectural invariant — see `THREAT_MODEL.md`,
  `CLAUDE.md`, `README.md`.
- **Saves & chronicles are local plaintext, not encrypted** (2026-07-16, commit
  `48712bd`). Deliberate: they hold story state, not secrets. Only API keys are
  encrypted at rest. See `THREAT_MODEL.md`.
- **`docs/BACKLOG.md` stays the forward backlog** (owner, 2026-07-18) — not
  archived, even with every unit `done`; STATE.md carries current state + the
  Owner queue. Revisit only if a large `done` tail crowds out live units.
- **No formal `docs/LEDGER.md` yet** (owner, 2026-07-18) — deferred until a
  durable cross-session lesson has no home in BACKLOG or `docs/audit-2026-07.md`.
  **Re-opened as an AMH v1.8 fork** (see Open questions).
- **eslint-plugin-react-hooks v7's new rules stay off** (owner, 2026-07-18) —
  ~34 findings deferred to a dedicated unit; several are effect-timing sensitive
  and need per-site review + tests, not a dep-bump side effect. `eslint.config.js`
  pins the two classic rules explicitly to keep them off.

## Changelog

One line per shipped change or completed unit (newest first). Pre-harness
history lives in `docs/BACKLOG.md` and git.

- 2026-07-25 — Adopt AMH v1.8, segment 1 of 4 (constitution): version stamp,
  instruction hierarchy (external content is data), leaked-credential protocol,
  bounded recovery with a second-retry stop, canonical-file rule + `AGENTS.md`
  pointer, agent-harness section. `docs/plans/amh-v1.8-adoption.md` carries the
  gap analysis, staged segments 2–4, and five owner forks.
- 2026-07-25 — Install rail: `PreToolUse` hook
  (`.claude/hooks/block-npm-install.mjs` + `.test.mjs`, 17 cases) denies
  `npm|pnpm|yarn|bun install|i|add|update|upgrade`, leaves `npm ci` alone, opts
  in via a segment-scoped `BORROWED_DEP_CHANGE=1`, fails open. Owner-sanctioned;
  in the `CLAUDE.md` tripwire list.
- 2026-07-25 — Clear the `@eslint/js` 10 lint fallout at the source: four
  `no-useless-assignment` errors (`gameLoop.ts`, `constants.ts`, `client.ts` ×2)
  that reddened #214. Adds `docs/dependabot-triage.md` (triage by failure shape)
  with a `CLAUDE.md` pointer.
- 2026-07-25 — Gemini deprecated `temperature`/`top_p`/`top_k` (3.5 Flash-Lite,
  3.6 Flash onward: ignored today, HTTP 400 later). The adapter omits it for
  3.5+ and keeps it for older models; `top_p`/`top_k` were never sent.
- 2026-07-22 — Refresh model catalogues (LLM only): `gemini-3.6-flash`, `kimi-k3`,
  OpenRouter `gpt-oss-20b:free` + `gpt-5.6-luna`; wiki synced.
- 2026-07-18 — Take the coupled Dependabot eslint majors together: eslint 9→10 +
  eslint-plugin-react-hooks 5→7; pin the classic react-hooks rules in
  `eslint.config.js` so v7's new rules don't newly gate. Superseded #206/#207.
- 2026-07-18 — Add the maintenance harness (`docs/STATE.md`, `scripts/ladder.sh`
  as the single CI-shared entrypoint, session discipline in `CLAUDE.md`,
  force-push / push-to-main deny rails, SessionStart branch check), then the
  secret-hygiene pass on top (Secret hygiene section, verification disclosure,
  env-dump deny rails). Owner kept BACKLOG, deferred LEDGER.
