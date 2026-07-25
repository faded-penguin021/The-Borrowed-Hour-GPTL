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

Standing harness: `scripts/check-supply-chain.mjs` (the `guard`), `.claude/`
SessionStart hook + permission rails, and the `model-catalogue-refresh` repo
skill.

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

**Open questions:** (none)

**Incoming findings:** (none)

## Decided non-items (don't re-litigate without new evidence)

- **The install rail keeps its `BORROWED_DEP_CHANGE=1` opt-out** (owner,
  2026-07-25) — "yes, in its narrow and well-defined scope." The rail
  (`.claude/hooks/block-npm-install.mjs`) is not absolute: a task whose stated
  purpose is a dependency change opts in explicitly, which keeps the intent
  auditable in the transcript instead of inviting workarounds. Narrow is load-
  bearing — the prefix exempts only the command segment it prefixes, never the
  rest of the line — and `.claude/hooks/block-npm-install.test.mjs` pins that.

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
- **No formal `docs/LEDGER.md` yet** (owner, 2026-07-18) — deferred. Add the
  numbered append-only ledger the first time a durable cross-session lesson has
  no home in BACKLOG or `docs/audit-2026-07.md`, and reconcile the audit doc in
  then.
- **eslint-plugin-react-hooks v7's new rules stay off** (owner, 2026-07-18) —
  `set-state-in-effect`, `immutability`, et al. (~34 findings) deferred to a
  dedicated backlog unit; several are effect-timing/behavior sensitive and need
  per-site review + tests, not a dep-bump side effect. `eslint.config.js` pins
  the two classic rules explicitly to keep them off.

## Changelog

One line per shipped change or completed unit (newest first). Pre-harness
history lives in `docs/BACKLOG.md` and git.

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
- 2026-07-22 — Refresh model catalogues (LLM only): `gemini-3.6-flash`,
  `kimi-k3`, OpenRouter `openai/gpt-oss-20b:free` + `gpt-5.6-luna`; wiki synced.
- 2026-07-18 — Take the coupled Dependabot eslint majors together: eslint 9→10 +
  eslint-plugin-react-hooks 5→7; pin the classic react-hooks rules in
  `eslint.config.js` so v7's new rules don't newly gate. Superseded #206/#207.
- 2026-07-18 — Harness v3 secret-hygiene pass: `CLAUDE.md` Secret hygiene section
  + verification-disclosure rule; `env` / `printenv` / `.env`-read deny rails in
  `.claude/settings.json`. Owner resolved both open questions (keep BACKLOG,
  defer LEDGER) — recorded under Decided non-items.
- 2026-07-18 — Add the maintenance harness: `docs/STATE.md`, `scripts/ladder.sh`
  (single verification entrypoint, STATE-length guard), CI wired to invoke it,
  session-discipline playbook folded into `CLAUDE.md`, force-push / push-to-main
  deny rails, and SessionStart branch check + protocol pointer.
