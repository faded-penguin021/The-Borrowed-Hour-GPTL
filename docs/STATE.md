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

**Shipped and in maintenance.** The 2026-07 audit + hardening pass (U0–B7, F1–F2) and the
improvement phase (H / T / E / P) are all `done` — `docs/BACKLOG.md` is the record.

Active multi-unit work: **`docs/plans/amh-principles-in-game.md`** (owner-approved, branch
`claude/text-adventure-amh-crkvd4`) — ports AMH's memory tiering into the *game*, which
had working memory only. **G1, G2, G4 done and glue-reviewed**; G3 open, G5 open with an
owner fork against it (Open questions). The plan holds the detail, including a secondary
AMH 4.2.0 → 14.0.0 track not yet in scope.

Standing harness: **AMH v4.2.0** at the **light** profile. `amh.conf` holds every
setting; shipped scripts are never edited locally and `scripts/MANIFEST.sha256` is
checked each run. `docs/LEDGER.md` is permanent memory and retrieval storage — grep one
row, never read a volume whole; `[cited]` markers are hand-written, machine-checked, not
synced. Plus `scripts/check-supply-chain.mjs` and the `model-catalogue-refresh` skill.

Verification = `scripts/ladder.sh` (rungs in `CLAUDE.md` → Conventions); it reports every
failure, so read past the first `FAIL`. Playwright e2e is **not** a rung: separate CI
job, locally needs `PW_CHROMIUM`. Real-provider / on-device behavior is owner-verified.

## Owner queue

> **Protected section.** Never delete it or silently drop items during compression
> (items leave only when done / answered / triaged, with the outcome recorded as a
> Changelog line). A session's final chat message restates this queue.

**Pending owner actions:**

1. **PR #221 (AMH v4.2.0) — reviewed, merge decision yours.** Both reviewable spans got a
   rule review: through `08a6cda` (3 findings, fixed in `1154190`) and `bcd016d`
   (4 findings, fixed). Unverifiable by any agent here: the shipped scripts' **upstream
   provenance** (clone deleted, manifest replaced in the same commit — re-clone the tag
   and diff to close it) and D-016's claims about upstream's `amh.conf.example`.
   `Check:` **`amh.conf`'s version on `origin/main`** — as of 2026-09-05 it already read
   4.2.0, i.e. merged. The old check grepped commit subjects and said "still open"
   regardless: 14.0.0's *working memory is tree-relative* defect, live.
2. **#213 (`typescript` 6.0.3→7.0.2) is upstream-blocked** — `typescript-eslint` 8.65.0
   declares `peer typescript >=4.8.4 <6.1.0`, so `npm ci` can't resolve and no rung runs.
   `overrides` / `--legacy-peer-deps` is not the move. Re-check on a TS7-capable major.
3. **Server-side rails** (owner, 2026-07-25) — branch protection on `main` (PRs required;
   force-push and deletion blocked) and secret-scanning push protection. Agent rails bind
   only agents that load them; the server binds every actor.

**Open questions:**

1. **G5 conflicts with what G2 shipped — story-ledger rows are now GM-only.** G2's review
   found the block invited GM-private facts (a settled twist the player has not learned)
   while rendering unmarked in the public block; the fix put rows on the `hidden_state`
   side of the wall. The plan's G5 says "Ledger + findings in the existing Ledger UI" — a
   **player-facing** surface. Both cannot hold. Options: (a) G5 surfaces findings only,
   rows stay GM-only — **recommended**, it keeps the tier able to hold unrevealed facts,
   which is the whole reason permanence is worth having; (b) rows become player-safe and
   unrevealed facts stay in `hidden_state`, i.e. the twist tier keeps the defect this plan
   exists to fix; (c) two row kinds with a `toPlayerLedger`-style projection — the honest
   option, the most work. Blocks G5, not G3.

**Incoming findings:**

1. **Pre-existing, found by G2's reviewer:** the meta-mode chronicle regex
   (`gameLoop.ts` ~350, `([\s\S]*)$`) captures greedily past `[Player action]` into the
   `[GM-PRIVATE]` block, so `hidden_state` reaches the meta model — whose output the
   player reads. Wants its own unit.
2. Same review, lower: model text containing a literal `[Player action]` defeats
   `stripHistoricalUser` (first-match). Pre-existing in kind. Accepted.

## Decided non-items

> Don't re-litigate without new evidence. **Protected section** — the structure guard
> hard-fails if this heading goes, so compression cannot re-open a closed decision.

- **AMH runs at the `light` profile** (owner, 2026-07-27) — light-plus: `docs/LEDGER.md`
  predates the install and was kept, presence outranking profile. Light withholds only a
  separate `docs/RUNBOOK.md`; playbooks stay in `CLAUDE.md` until they multiply.
  Escalating is a re-run with `--profile standard`, which only adds files.
- **Shipped AMH scripts are never edited locally** — a local edit turns every future
  upgrade from a copy into a silent merge. Changes go to one of the three extension
  points: `amh.conf`, `scripts/guards/*.sh`, `scripts/verify.sh`.
- **The install rail keeps its `BORROWED_DEP_CHANGE=1` opt-out** (owner, 2026-07-25),
  "in its narrow and well-defined scope". Narrow is load-bearing — the prefix exempts
  only the segment it prefixes, pinned by `scripts/install-guard.sh --self-test`.
- **`scripts/redact.sh` is the secret scan, not an output filter** (2026-07-27). No
  output-rewriting hook exists, so piping stays manual — but the ladder runs the filter
  over every text file.
- **No backend of this project's own.** All state in the browser; keys go straight from
  browser to provider (a user's own BYOB proxy is theirs, not ours). See `THREAT_MODEL.md`.
- **Saves & chronicles are local plaintext, not encrypted** (2026-07-16, `48712bd`).
  Deliberate: they hold story state, not secrets. Only API keys are encrypted at rest.
- **`docs/BACKLOG.md` stays the forward backlog** (owner, 2026-07-18), not archived.
- **`docs/LEDGER.md` is permanent memory** (owner, 2026-07-25). Append-only; durable facts
  go there, never into STATE, which is compressed away.
- **Fresh-context review is the one subagent exception** (owner, 2026-07-25) — D-004.
- **A pending review never holds the checkpoint** (owner, 2026-07-25) — D-012.
- **Merge mode is branch-per-change** (owner, 2026-07-25), branches cut from `main`. PR
  #215's blob was a one-time owner exception, not precedent — D-014.
- **eslint-plugin-react-hooks v7's new rules stay off** (owner, 2026-07-18) — ~34
  findings, several effect-timing sensitive; they need a unit, not a dep-bump side effect.

## Changelog

One line per shipped change or completed unit (newest first). Detail lives in git; the
durable lessons live in `docs/LEDGER.md`.

- 2026-09-05 — **`docs/plans/amh-principles-in-game.md`, units G1 + G4 + G2.**
  `StoryLedger` is the story's permanent tier: append-only for the GM, deduped, capped,
  rolling the oldest batch into a frozen chronicle rather than deleting it; carried by
  save schema v2. G2 gave it a producer and a reader — `story_ledger_append` on both GM
  tools, Zod-salvaged per element, the block rendered above the mutable state each turn.
  Glue-reviewed at both steps (9 findings, then 8), all fixed or queued; the durable ones
  are D-018, D-019, D-020.
- 2026-08-30 → 07-18 — **Everything before the in-game plan, folded.** Four
  model-catalogue refreshes (#227, #224, #219, one more; image/TTS unchanged, wiki
  synced). The harness: v1.8 hand-rolled (07-18, hardened 07-25) → AMH v2.1.0 at `light`
  (07-27) → v4.2.0 (08-09), plus `LEDGER_ROW_CHAR_CAP` 2000→**800** that day (new rows
  only; it and `LEDGER_LINE_CAP` share digits by coincidence — never reconcile them).
  Rule-reviewed at each step; lessons D-008 → D-016. Alongside: the `@eslint/js` 10 lint
  fallout cleared at source, `docs/dependabot-triage.md`, and Gemini `temperature`
  omitted for 3.5+ models (deprecated there).
