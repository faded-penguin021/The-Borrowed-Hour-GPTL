# STATE — project state & session memory

> **Length guard (hysteresis).** Grow freely to **14 KB**; do no trimming below that
> line. When the guard warns, run ONE deep compression pass to **≤ 9 KB** — never to just
> under the warn line, which re-arms it a session later. The wide band *is* the debounce,
> statelessly (D-005). Fail over **16 KB**. The numbers live in `amh.conf`; keep this
> preamble in lockstep with them.
>
> Compressing means: one Changelog line per completed unit, fold changelog clusters, move
> durable gotchas into `docs/LEDGER.md` (append-only — that is where facts survive), delete
> narrative prose. **Project**, **Current state**, **Owner queue**, **Decided non-items**
> and **Changelog** must always survive; `scripts/ladder.sh` checks their presence and
> non-emptiness, the sizes, duplicate headings, and a **landing check** failing a
> compression that clears the warn but stops inside the band. The content rules above are
> **prose-only**: no guard tells a compressed item from a deleted one.

## Project

The Borrowed Hour — a fully client-side, single-page literary text adventure. No
backend: players bring their own API keys and the browser talks straight to LLM / image
/ TTS providers. Vite 8 + React 19 + TypeScript (strict), Tailwind 4, Vitest (unit) +
Playwright (e2e), ESLint 10, Node 24 in CI. Shipped and deployed to GitHub Pages from
`main` (`.github/workflows/pages.yml`).

## Current state

**Shipped and in maintenance.** The 2026-07 audit + hardening pass and the improvement
phase are `done`; `docs/BACKLOG.md` is the record.

**`docs/plans/amh-principles-in-game.md` is complete through G5** (branch
`claude/text-adventure-amh-crkvd4`, awaiting merge) — AMH's memory tiering ported into the
*game*, which had working memory only. G6 is listed, not planned. Next is that plan's
**secondary track, AMH 4.2.0 → 14.0.0** (owner-scheduled).

Standing harness: **AMH v4.2.0**, `light` profile — `amh.conf` holds every setting and
`CLAUDE.md` the rules; `docs/LEDGER.md` is permanent memory and retrieval storage (grep
one row, never read a volume whole). Verification is `scripts/ladder.sh`, which reports
every failure, so read past the first `FAIL`. Playwright e2e is **not** a rung: separate
CI job, locally needs `PW_CHROMIUM`. Real-provider / on-device behavior is owner-verified.

## Owner queue

> **Protected section.** Never delete it or silently drop items during compression
> (items leave only when done / answered / triaged, with the outcome recorded as a
> Changelog line). A session's final chat message restates this queue.

**Pending owner actions:**

1. **#213 (`typescript` 6.0.3→7.0.2) is upstream-blocked** — `typescript-eslint` 8.65.0
   declares `peer typescript >=4.8.4 <6.1.0`, so `npm ci` can't resolve and no rung runs.
   `overrides` / `--legacy-peer-deps` is not the move. Re-check on a TS7-capable major.
   Confirmed still blocked 2026-09-05.
2. **AMH 4.2.0 → 14.0.0 upgrade — in scope, owner will run it** (owner, 2026-09-05).
   Twenty-one releases; the missing rails, the two missing config keys and the upgrade
   path are inventoried in `docs/plans/amh-principles-in-game.md` → *Secondary track*.
   Sharpest absence: the `.gitattributes` seed (10.4.0) — without it a CRLF checkout makes
   the ladder unrunnable.

**Open questions:** (none.)

**Incoming findings:** (none — the three from the G-track reviews were triaged by the
owner 2026-09-05; outcomes below.)

**Owner-verified only** (no rung reaches these, both need a real key over a long session):
whether the continuity rules fire at a useful rate against a live GM, and whether the
story ledger holds continuity past a history prune at turn 40+.

## Decided non-items

> Don't re-litigate without new evidence. **Protected section** — the structure guard
> hard-fails if this heading goes, so compression cannot re-open a closed decision.

- **Meta mode is allowed to spill the story's secrets** (owner, 2026-09-05). The chronicle
  regex (`gameLoop.ts` ~350, `([\s\S]*)$`) captures past `[Player action]` into
  `[GM-PRIVATE]`, so `hidden_state` reaches the meta model whose output the player reads.
  That is the feature: meta mode is where the player steps out of the hour and asks about
  it. Not a leak, not a unit. Same day: a literal `[Player action]` in model text
  defeating `stripHistoricalUser` (first-match) is **accepted**, no fix planned.
- **Story-ledger rows stay GM-only; G5 surfaces continuity findings, not rows** (owner,
  2026-09-05, option (a) of the G5 fork). Keeping rows behind the `hidden_state` wall is
  what lets the tier hold a fact the player has not learned yet — the main reason
  permanence is worth having. Rejected: player-safe rows (pushes unrevealed facts back
  into `hidden_state`, the exact weakness the plan fixes) and a two-kind projection
  (honest but disproportionate). Revisit only if findings alone prove too thin a surface.
- **Harness shape, settled 2026-07** (owner): AMH runs at the **`light` profile**
  (light-plus — `docs/LEDGER.md` predates the install and was kept; light withholds only a
  separate `docs/RUNBOOK.md`, so playbooks stay in `CLAUDE.md` until they multiply).
  **Shipped AMH scripts are never edited locally** — a local edit turns every future
  upgrade from a copy into a silent merge, so changes go to `amh.conf`,
  `scripts/guards/*.sh` or `scripts/verify.sh`. The install rail keeps its
  **`BORROWED_DEP_CHANGE=1` opt-out** "in its narrow and well-defined scope" — narrow is
  load-bearing, the prefix exempts only the segment it prefixes, pinned by
  `install-guard.sh --self-test`. **`scripts/redact.sh` is the secret scan, not an output
  filter**: no output-rewriting hook exists, so piping stays manual.
- **Process, settled 2026-07** (owner): `docs/BACKLOG.md` stays the forward backlog, not
  archived; `docs/LEDGER.md` is append-only permanent memory and durable facts go there,
  never into STATE; fresh-context review is the one subagent exception (D-004) and never
  holds the checkpoint (D-012); merge mode is branch-per-change with branches cut from
  `main` (PR #215's blob was a one-time exception, not precedent — D-014);
  eslint-plugin-react-hooks v7's new rules stay off (~34 findings, several effect-timing
  sensitive — a unit, not a dep-bump side effect).
- **Product invariants**: **no backend of this project's own** — all state in the browser,
  keys straight from browser to provider, a user's own BYOB proxy is theirs
  (`THREAT_MODEL.md`); **saves & chronicles are local plaintext** (2026-07-16, `48712bd`)
  — story state, not secrets; only API keys are encrypted at rest.

## Changelog

One line per shipped change or completed unit (newest first). Detail lives in git; the
durable lessons live in `docs/LEDGER.md`.

- 2026-09-05 — **Load-save/abort race closed.** `submit` and `beginAdventure` awaited the
  ambience warm-up *before* assigning `abortRef.current`, so a save loaded in that window
  found nothing to cancel and was clobbered by the turn resuming over it. The warm-up now
  runs after the abort ref, with an aborted check behind it. Not theoretical: the first
  call per session fetches a ~33 kB lazy chunk and `setLoading(true)` landed only after
  it, so turn one on a cold cache showed nothing busy. Vectored.
- 2026-09-05 — **Owner queue cleared to two items.** All three Incoming findings triaged
  and moved to Decided non-items — the list is empty for the first time this plan. PR #221
  was already merged (its own `Check:` grepped commit subjects and said "still open"
  regardless: 14.0.0's *working-memory-is-tree-relative* defect, live), and the
  server-side rails are **done** — branch protection + secret-scanning push protection.
- 2026-09-05 — **G1–G5, the whole G-track** of the in-game plan: `StoryLedger` as the
  story's permanent tier (append-only, capped, rolling into a frozen chronicle, carried by
  save schema v2), its producer and per-turn prompt block, `checkContinuity`'s four
  advisory rules over the state diff — structural drift only, never semantic
  contradiction — and a player surface that folds a finding until asked for, since one can
  point at a spoiler. Glue reviewed at every step (9, 8, 7, then 5 findings); lessons
  D-018, D-019, D-020. The plan's fifth rule (ending integrity) was dropped, not built:
  `EndingSchema` already nulls anything invalid.
- 2026-08-30 → 07-18 — **Everything before the in-game plan, folded.** Four
  model-catalogue refreshes (#227, #224, #219, one more; image/TTS unchanged, wiki
  synced). The harness: v1.8 hand-rolled (07-18, hardened 07-25) → AMH v2.1.0 at `light`
  (07-27) → v4.2.0 (08-09), plus `LEDGER_ROW_CHAR_CAP` 2000→**800** that day (new rows
  only; it and `LEDGER_LINE_CAP` share digits by coincidence — never reconcile them).
  Rule-reviewed at each step; lessons D-008 → D-016. Alongside: the `@eslint/js` 10 lint
  fallout cleared at source, `docs/dependabot-triage.md`, and Gemini `temperature`
  omitted for 3.5+ models (deprecated there).
