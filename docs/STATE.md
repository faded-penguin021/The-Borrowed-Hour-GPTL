# STATE — project state & session memory

> **Length guard (read before editing — hysteresis).** Grow freely to **14 KB**;
> do no trimming below that line. When the guard warns, run ONE deep compression
> pass to **≤ 9 KB** — never trim to just under the warn line. Micro-trims re-arm
> the warn a session later; the wide band *is* the debounce, statelessly (D-005).
> Fail over **16 KB**.
>
> Compression means: collapse each completed unit into one Changelog line, fold
> changelog clusters, move any durable gotcha into `docs/LEDGER.md` (permanent,
> append-only — that is where facts survive), and delete narrative prose. The
> **Project**, **Current state**, and **Owner queue** sections must always
> survive compression (Owner-queue items are the owner's to close — compress
> their prose, never drop an open item).
>
> `scripts/ladder.sh` machine-checks the sizes and the protected headers: warn
> > 14 KB, fail > 16 KB, a **landing check** (a change that trims the file out of
> warn territory but leaves it in the 9–14 KB band FAILS, so a compression must
> reach the ≤ 9 KB floor rather than merely clear the warn — baselined against
> the branch's merge base), and the presence of the four protected sections. The
> compression *content* rules above — what to fold, what to push down to the
> ledger, "compress an Owner-queue item's prose, never drop the item" — are
> **prose-only**: no guard can tell a compressed item from a deleted one.

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

Standing harness: **AMH v1.8** — all five owner forks resolved 2026-07-25;
`docs/LEDGER.md` is now permanent memory (machine-verified `[cited]` markers).
Remaining segment in `docs/plans/amh-v1.8-adoption.md`. Plus
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

3. **Server-side rails** (owner, 2026-07-25: "I'll add those rules to the
   repo") — branch protection on `main` (PRs required; force-push and deletion
   blocked) and secret-scanning push protection. Agent rails bind only agents
   that load them; the server binds every actor.

4. **Merge #215 as-is** (owner, 2026-07-25). It carries four independent changes
   — the Gemini fix, the eslint 10 cleanup + triage playbook, the command rail,
   and the AMH v1.8 adoption — because follow-up work was stacked onto the
   session branch instead of cutting a new one from `main` each time. The owner
   accepted the blob rather than replaying it. **One-time exception, not a
   precedent:** branch-per-change still binds (D-013).

**Open questions:** (none — the owner resolved all five AMH v1.8 forks on
2026-07-25; see Decided non-items.)

**Incoming findings:** (none)

## Decided non-items (don't re-litigate without new evidence)

- **The install rail keeps its `BORROWED_DEP_CHANGE=1` opt-out** (owner,
  2026-07-25) — "in its narrow and well-defined scope": a dependency-change task
  opts in explicitly, keeping intent auditable instead of inviting workarounds.
  Narrow is load-bearing — the prefix exempts only the segment it prefixes, and
  `scripts/command-guard.sh --self-test` pins that.

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
- **`docs/LEDGER.md` is permanent memory** (owner, 2026-07-25 — supersedes the
  2026-07-18 deferral). Append-only, code cites bare `D-NNN`, and the `[cited]`
  markers are machine-synced in both directions by the ladder. Durable facts go
  there, never into STATE, which is compressed away.
- **Fresh-context review is the one subagent exception** (owner, 2026-07-25 —
  D-004). Glue review and rule review spawn a single blocking, sequential
  reviewer inside the unit; the ban on parallel subagents otherwise stands.
- **A pending review never holds the checkpoint** (owner, 2026-07-25 — D-012).
  Commit and push at green, run the reviewer, land findings in a follow-up
  commit. The gate is the branch merging, not the individual commit.
- **Merge mode is branch-per-change** (owner, 2026-07-25) — one squash commit per
  session branch, branches cut from `main`. Not a branch train.
- **eslint-plugin-react-hooks v7's new rules stay off** (owner, 2026-07-18) —
  ~34 findings deferred to a dedicated unit; several are effect-timing sensitive
  and need per-site review + tests, not a dep-bump side effect. `eslint.config.js`
  pins the two classic rules explicitly to keep them off.

## Changelog

One line per shipped change or completed unit (newest first). Pre-harness
history lives in `docs/BACKLOG.md` and git.

- 2026-07-25 — Merge the duplicated review-ordering rule into one ordered
  statement; the prior commit had appended the new rule beside the old one, so
  the section said both hold and don't hold the checkpoint (D-013).
- 2026-07-25 — Write down how the checkpoint invariant and fresh-context review
  compose: push at green, review inside the same unit, findings in a follow-up
  commit; the branch merging is the gate, not the commit. Resolves the question
  that recurred three times in one session (D-012).
- 2026-07-25 — Segment 4a: `scripts/command-guard.sh` replaces the Claude-only
  JS install hook — agent-neutral (`--command` / stdin JSON / `--self-test`),
  covering all four hard rails (registry installs, force-push, pushes to `main`,
  env and `.env` dumps) with instructive deny reasons. 56 self-test cases as a
  ladder rung. Rule review found the rail let `git -C path push --force` and
  `npm --prefix x install` through and wrongly blocked `env FOO=bar <cmd>`; all
  fixed and pinned (D-010).
- 2026-07-25 — AMH v1.8 segments 1–3: constitution (version stamp, instruction
  hierarchy, leaked-credential protocol, bounded recovery, `AGENTS.md` pointer);
  then the owner's five fork answers — `docs/LEDGER.md` as permanent memory with
  bidirectional machine-synced `[cited]` markers, fresh-context glue/rule review
  as the one subagent exception, branch-per-change written down, STATE hysteresis
  (9/14/16 + landing check). New ladder guards: STATE hysteresis + landing,
  STATE structure, ledger rollover + citation integrity — plus
  `scripts/test-ladder-guards.sh` (14 fixture cases) and the rail self-test, both
  now ladder rungs. First mandatory rule review ran fresh-context and returned 11
  findings; the substantive ones are fixed (dead landing check → merge-base
  baseline D-009, `set -e` abort on a header-only ledger, the still-binding
  subagent ban in `docs/BACKLOG.md`, unprotected Decided non-items, two guard
  self-reference traps D-008, and three prose overclaims). Segment 4 (agent-neutral
  bootstrap, generalized command guard) remains.
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
