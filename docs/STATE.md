# STATE — project state & session memory

> **Length guard.** Thresholds are in `amh.conf`; the rules for compressing this file are
> `docs/RUNBOOK.md` → **Working-memory compression**, and they bind whether or not you follow this
> pointer. Compress by lifecycle, not by file size: fold a stage's narrative once the stage is
> complete, even below the compression trigger, and keep only current state, unresolved owner
> items, immediate operational gotchas and concise Changelog pointers.
>
> **Tree-relative.** That same section says what may be in `Current state` at all: what stays
> true of the checked-out tree, never world-controlled status (merged, tagged, released, PR and
> CI state, deployments, remote branches, forge settings) as current truth. Point at a live
> probe instead of storing its last answer, route an unresolved external action to the Owner
> queue, and scope a retained past observation to when it was seen. The Changelog and the
> ledger pointers are historical storage and are exempt. Prose-only — no guard judges it.

## Project

The Borrowed Hour — a fully client-side, single-page literary text adventure. No
backend: players bring their own API keys and the browser talks straight to LLM / image
/ TTS providers. Vite 8 + React 19 + TypeScript (strict), Tailwind 4, Vitest (unit) +
Playwright (e2e), ESLint 10, Node 24 in CI. The tree carries a GitHub Pages deploy
workflow on `main` (`.github/workflows/pages.yml`); whether a given deploy ran is
world-controlled and is not recorded here.

## Current state

**Shipped and in maintenance.** The 2026-07 audit + hardening pass and the improvement
phase are `done`; `docs/BACKLOG.md` is the record.

<!--
Write what a fresh clone of THIS COMMIT would still find true. Test each sentence: would it
hold tomorrow, under another branch name, after forge state had moved? If not, it belongs at a
live probe, in the Owner queue, or scoped as a dated observation — not here as fact. Do not
write "released", "tagged", "merged", "CI is green" or "deployed" as current state.
-->

`docs/plans/amh-principles-in-game.md` is **complete through G5** — AMH's memory tiering
ported into the *game*, which had working memory only. G6 is listed, not planned. That plan's
secondary track (the harness upgrade) is done; what it inventoried is now in the tree. The
plan is **retained, not yet archived**, because G6 is still open — plans end archived or
deleted, and no ledger row cites its path, so dropping G6 is all that stands between it and
disposal.

Standing harness: **AMH v14.0.0** — `amh.conf` holds every setting, `CLAUDE.md` the rules and
`docs/RUNBOOK.md` the playbooks (session discipline, the ladder, working-memory compression,
the review protocols, supply chain, the leaked-credential incident). `docs/LEDGER.md` is the
live ledger volume: permanent memory and retrieval storage (grep one row, never read a volume
whole). Verification is `scripts/ladder.sh`, which reports every failure, so read past the
first `FAIL`. Playwright e2e is **not** a rung: separate CI job, locally needs `PW_CHROMIUM`.
Real-provider / on-device behavior is owner-verified.

## Owner queue

> **Protected section.** Never delete it or silently drop items during compression; items
> leave only when done / answered / triaged, with the outcome recorded as a Changelog line or
> a ledger row. Every item carries a `Check:` that settles it from the tree or the world. A
> session's final chat message restates this queue (`docs/RUNBOOK.md` → Session discipline 5).

**Pending owner actions:**

1. **#213 (`typescript` 6.0.3→7.0.2) is upstream-blocked.** `typescript-eslint` 8.65.0
   declares `peer typescript >=4.8.4 <6.1.0`, so `npm ci` can't resolve and no rung runs.
   `overrides` / `--legacy-peer-deps` is not the move. Observed still blocked 2026-09-05.
   Check: `npm view typescript-eslint peerDependencies.typescript` — a range admitting 7.x
   means it is unblocked; re-run the ladder and close this.

**Open questions:**

1. **Do the two CodeQL alerts actually clear?** The flagged patterns
   (`src/__tests__/tts-adapters.test.tsx` incomplete escaping, `e2e/proxy.spec.ts` URL
   substring sanitization) were rewritten 2026-09-06, but no rung and no local run reaches
   CodeQL — only a scan on `main` settles it, and the query could still object to the
   dynamic `new RegExp` on other grounds. Check:
   `gh api repos/faded-penguin021/The-Borrowed-Hour-GPTL/code-scanning/alerts --jq
   '[.[]|select(.state=="open")|.rule.id]'` — neither `js/incomplete-sanitization` nor
   `js/incomplete-url-substring-sanitization` present means closed; delete this item.

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
- **Harness shape** (owner, 2026-07, revised 2026-09-06): AMH runs at the **`light` profile**
  plus both tiers light withholds: `docs/LEDGER.md`, which predates the install and was kept,
  and `docs/RUNBOOK.md`, split out of a 616-line `CLAUDE.md` on 2026-09-06 at the owner's call.
  The constitution states the rules; the runbook holds the playbooks; neither repeats the
  other, and `scripts/guards/doc-navigation.sh` checks the headings AND the pointers between
  them, since guarding only the heading is how a relocation becomes a silent repeal.
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

- 2026-09-06 — **Two CodeQL-flagged patterns in test code rewritten** (clearance unconfirmed
  until a scan runs on `main` — Owner queue). The
  connect-src wildcard matcher in `tts-adapters.test.tsx` escaped only `.` before building
  its regex, so any other metacharacter in a declared origin would have reached the pattern
  — literal segments are now escaped whole and only the `*` separators become pattern. The
  BYOB proxy e2e asserted `decodeURIComponent(url).includes("api.openai.com")`, which a path
  or neighbouring param could satisfy; it now parses `?target=` and compares the hostname,
  which is also the stronger assertion. No runtime code changed. Ladder green; the proxy spec
  run locally with `PW_CHROMIUM`.

- 2026-09-06 — **Rule review of the split: 13 findings, all triaged.** The worst were mine to
  own: the relocated rule-review scope list said "this file" and so had quietly stopped covering
  `CLAUDE.md`; the leaked-credential protocol had no pointer from the constitution at all; and
  the new guard passed on a pointer that had been destroyed, three times over, until it matched
  the pointer's *form* rather than its words. Verbatim relocation is not referent-safe — D-030.
  Numbers corrected (1030/1151/~160 B per sentence). Owner-overturned rows now carry correction
  pointers to D-028; the spent grant moved to D-029.

- 2026-09-06 — **`docs/RUNBOOK.md` split out of the constitution** (owner's call). `CLAUDE.md`
  had reached 616 lines; it is now 365 and states rules only, with the playbooks moved verbatim
  to a 323-line runbook and a pointer left at every seam. New repo-local guard
  `scripts/guards/doc-navigation.sh` fails on a missing destination heading OR a deleted
  pointer, in both directions, and was proven to fail before being trusted.

- 2026-09-06 — **Owner review of the 14.0.0 upgrade.** `LEDGER_ROW_CHAR_CAP` settled at
  **1400** — not the old 800 (which rejects a sentence-compliant 1029-byte row on bytes and
  restores the shave reflex) and not the shipped 2000 (which could not honestly be promised to
  stay a ceiling). The 2026-09-05 fork-deciding grant is recorded as spent and ruled never
  durable. One review finding reported fixed the day before was not: the edit silently no-opped
  — D-027, now fixed for real.

- 2026-09-05 — **AMH 4.2.0 → 14.0.0**, twenty-one releases in one pass. Five shipped scripts
  + manifest replaced; `amh.conf` gained `STATE_COMPRESS_TO_SENTENCES=50` and
  `LEDGER_ROW_SENTENCE_CAP=6` and returned `LEDGER_ROW_CHAR_CAP` to 2000; `.gitattributes`
  seeded (10.4.0 — without it a CRLF checkout will not run the ladder at all on macOS/Linux);
  six private-key `Read()` denies and the `Task` spawn advisory wired; the git-native pre-push
  rail installed. Prose: the constitution took the states-it-now rule, coverage-before-absence,
  the plan-lifecycle and ledger-immutability rules, CI triage, and a new **Working-memory
  compression** section; STATE's preambles became pointers and `Current state` was audited for
  world-controlled claims (14.0.0). History relocated to D-021…D-023; lessons D-024, D-025.

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
  only; reversed on the 14.0.0 upgrade).
  Rule-reviewed at each step; lessons D-008 → D-016. Alongside: the `@eslint/js` 10 lint
  fallout cleared at source, `docs/dependabot-triage.md`, and Gemini `temperature`
  omitted for 3.5+ models (deprecated there).
