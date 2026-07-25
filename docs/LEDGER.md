# DEVIATIONS & DISCOVERIES LEDGER — permanent registry (D-001…)

> **Append-only registry — NEVER archived, compressed, or truncated.** This is
> the canonical, permanent home for every numbered deviation and discovery.
> Code and docs cite entries as bare `D-NNN` and must always resolve here — no
> entry may ever be deleted or summarized away. Append new entries at the
> bottom, one continuous sequence. Code + committed tests are ground truth; if
> an entry conflicts with current code, trust the code and correct the entry
> (never delete it).
>
> **Search before appending:** grep this file for the topic first — extend or
> cite an existing row rather than append a near-duplicate. A row that
> supersedes an older one says so ("supersedes D-NNN"), and the old row gets a
> correction pointer, never deletion.
>
> **File cap & rollover.** This file holds at most **800 lines** (the cap is on
> LINES, not rows — it's read cost being bounded; keep the number in lockstep
> with the ladder guard's `LEDGER_LINE_CAP`). The final row may finish past the
> cap, but no row may ever *start* past it: when the file stands over the cap,
> create `LEDGER_A.md` with this same header, numbering from **DA-001** (then
> `_B.md` / DB-001, …). Existing rows are never moved or renumbered; a
> citation's prefix names its file.
>
> **`[cited]` marker (machine-managed).** A row cited from code carries
> ` [cited]` after its number. `scripts/ladder.sh` syncs it in both directions —
> cited-but-unmarked and marked-but-uncited both fail — so the marker is
> verified derived state, never hand-tracked. It warns you that code resolves
> here before you lean on or reword a row.
>
> What the guard checks is **token sync and row existence** — that every
> `D-NNN` appearing in code or docs resolves to a row, and that markers match
> the code-citation set. It cannot check that the row actually *supports* the
> claim made at the citation site; that is the rule reviewer's job (`CLAUDE.md`
> → Fresh-context review). Doc citations are existence-checked but never carry
> the marker.

- D-001 [cited]: Gemini deprecated `temperature` / `top_p` / `top_k` starting with 3.5
  Flash-Lite and 3.6 Flash. They are accepted-and-ignored on those models today
  and documented to return HTTP 400 in future generations, so a request that
  sends them is carrying a dead parameter that later becomes a hard error. The
  adapter omits `temperature` for 3.5+ via a version threshold (so 4.x is
  covered in advance) and keeps sending it for older models such as
  `gemini-3.1-flash-lite`, which still honor it. The app never sent
  `top_p`/`top_k`. Standing invariant: a provider that *ignores* a parameter is
  a deprecation notice, not a free pass — treat silence as the warning.
- D-002: `@eslint/js` 10 adds `no-useless-assignment` to `recommended`, which
  errored on four pre-existing sites here. The general lesson is the triage
  shape, written up in `docs/dependabot-triage.md`: a red Dependabot PR is
  classified by *which ladder rung* fails — `npm ci` (peer-range block:
  upstream-gated, Owner queue, never force with `overrides` /
  `--legacy-peer-deps`), `check` (lint/type fallout: fix our source on a normal
  branch, never in Dependabot's branch — it force-pushes over you), tests/build
  (real behavior change: its own unit).
- D-003 [cited]: The `PreToolUse` install rail cannot be tested from a shell loop — a
  command line containing the literal test strings is blocked by the rail under
  test. Cases must be assembled from fragments and fed as JSON payloads
  (`.claude/hooks/block-npm-install.test.mjs`). This is not incidental: it is
  how a real bug surfaced — a rewrite that made the opt-out segment-scoped
  shifted the regex capture groups while the deny message still read the old
  indices, so the block named the verb where the manager belonged. Any rail
  whose own diagnostics are user-visible needs a case asserting the *message*,
  not just the decision.
- D-004: AMH v1.8's review protocols (P12) require a fresh-context reviewer and
  forbid self-review for binding-rule diffs; this repo's session discipline
  banned parallel subagents outright. A direct rule collision, surfaced when
  v1.8 was adopted. Resolved by the owner, 2026-07-25: **glue review and rule
  review with a fresh context are the sanctioned exception** — one blocking,
  sequential reviewer inside the unit is not fan-out, and the ban continues to
  cover parallel work. Standing invariant: when adopting external process rules
  wholesale, diff them against the standing rules first — the collision is the
  finding.
- D-005 [cited]: A size guard with a single soft cap invites the Goodhart micro-trim:
  shave bytes until the warn clears, and it re-arms a session later. Observed
  live on 2026-07-25 while compressing `docs/STATE.md` — three successive
  byte-shaves against an 8 KB line. The fix is hysteresis plus a landing check:
  a wide band between the compress-to floor and the warn line is the debounce
  (statelessly), and a change that trims the file out of warn territory but
  lands *in* the band fails rather than passes.
- D-006: `typescript` 7.x is blocked here by `typescript-eslint`, whose 8.x line
  declares `peer typescript >=4.8.4 <6.1.0` (still capped at 8.65.0). `npm ci`
  cannot resolve, so no ladder rung runs at all. Nothing in this repo fixes it;
  it clears when typescript-eslint ships a TS7-capable major. Do not force it
  with `overrides` or `--legacy-peer-deps` — that runs tsc and the linter in a
  combination upstream does not support.
- D-007: Guards must be proven to FIRE, not just to pass — but never prove it by
  mutating a working-tree file and reverting with `git checkout -- <file>`. On
  2026-07-25 that reverted uncommitted edits in `docs/STATE.md` (real work lost
  and rewritten) while silently failing on the untracked `docs/LEDGER.md`,
  leaving its mutation in place. Exercise a guard's failure paths against copies
  in the scratchpad, or commit first so the revert is a no-op. This is what a
  guard fixture suite is for.
- D-008: A size/citation guard tends to count its own diagnostics. Two live
  instances on 2026-07-25: the landing-check FAIL string in `scripts/ladder.sh`
  cites D-005, so the citation guard counted the citation guard (rewording the
  message would have failed the build with "marked [cited] but no longer
  cited"), and the guard fixture suite's synthetic `D-404` tripped the same scan.
  Rule: a scan's own fixtures and self-referential prose are excluded from its
  scope, and rows illustrating future rollover prefixes are not citations.
- D-009: A guard baselined on `HEAD` cannot fire in CI, where the working tree
  always equals HEAD. The first landing check compared the working tree against
  `HEAD`/`HEAD~1` and was dead code twice over: command substitution strips
  trailing newlines, so the "did it change?" byte comparison was always true and
  the fallback was unreachable. Baseline branch-scoped state against
  `git merge-base origin/main HEAD`, and read blob sizes with `git cat-file -s`,
  never through a shell variable. Found by fresh-context rule review, not by any
  passing run.
