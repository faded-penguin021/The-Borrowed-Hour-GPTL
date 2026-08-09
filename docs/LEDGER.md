# DEVIATIONS & DISCOVERIES LEDGER — permanent registry (D-001…)

> **Append-only registry — NEVER archived, compressed, or truncated.** This is
> the canonical, permanent home for every numbered deviation and discovery.
> Code and docs cite entries as bare `D-NNN` and must always resolve here — no
> entry may ever be deleted or summarized away. Append new entries at the
> bottom, one continuous sequence. Code + committed tests are ground truth; if
> an entry conflicts with current code, trust the code and correct the entry
> (never delete it).
>
> **This file is RETRIEVAL storage: grep it and cite it, never read it whole.**
> A `D-NNN` citation resolves to one row, and one row is what you read. A volume
> at its cap is tens of kilobytes whose overwhelming majority is irrelevant to
> any given session, so reading it end to end spends context better spent on the
> code you came to change. The ladder's cap rung prints a size in KB beside the
> line count so the read cost the cap stands in for stays visible, and it
> measures the **live** volume only — once this file rolls over its own size
> stops being reported.
>
> **Search before appending:** grep this file for the topic first — extend or
> cite an existing row rather than append a near-duplicate. A row that
> supersedes an older one says so ("supersedes D-NNN"), and the old row gets a
> correction pointer, never deletion. **Keep new rows at or below
> `LEDGER_ROW_CHAR_CAP`** (2000 bytes under `LC_ALL=C`; ASCII is one byte per
> character): capture the durable lesson, not the whole debugging narrative.
>
> **File cap & rollover.** This file holds at most **800 lines** (the cap is on
> LINES, not rows — it's read cost being bounded; keep the number in lockstep
> with the ladder guard's `LEDGER_LINE_CAP`). Rows already committed when
> checked are historical and exempt from the row cap, so append-only history is
> never rewritten. The final row may finish past the file cap, but no row may
> ever *start* past it: when the file stands over the cap, create `LEDGER_A.md`
> with this same header, numbering from **DA-001**. The suffix advances as an
> **odometer over A–Z, not a list with a last entry**: `_Z` rolls to `_AA`, `_AZ`
> to `_BA`, `_ZZ` to `_AAA`, without limit. The ladder computes that name and
> prints it in the failure telling you to roll over, so you never spell it
> yourself. Existing rows are never moved or renumbered; a citation's prefix
> names its file.
>
> **The volumes form a CHAIN, and the ladder walks it from `LEDGER.md`, stopping
> at the first missing link.** A volume is a file the scheme can *reach*, not a
> file whose name looks right: a `LEDGER_X.md` with no `LEDGER_A.md`…`_W.md`
> before it is unreachable and its rows are read by nothing. The rung warns
> naming the unreachable file, and fails outright if `LEDGER.md` itself is the
> missing one.
>
> **`[cited]` marker (machine-CHECKED — you write it, the ladder verifies it).**
> A row cited from the ladder's scan scope carries ` [cited]` after its number.
> `scripts/ladder.sh` checks it in both directions — cited-but-unmarked and
> marked-but-uncited each fail — but it never edits this file: **nothing syncs
> the marker for you.** It warns you that code resolves here before you lean on
> or reword a row.
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
  (`scripts/command-guard.sh --self-test`). This is not incidental: it is
  how a real bug surfaced — a rewrite that made the opt-out segment-scoped
  shifted the regex capture groups while the deny message still read the old
  indices, so the block named the verb where the manager belonged. Any rail
  whose own diagnostics are user-visible needs a case asserting the *message*,
  not just the decision.
  (Correction 2026-07-25: the rail moved from `.claude/hooks/block-npm-install.mjs`
  to `scripts/command-guard.sh --self-test`. The fragment-assembly constraint
  survives the move; the JSON-payload mechanism does not — the bash matrix calls
  the check function in-process, which is exactly why the entrypoint itself
  needed separate end-to-end cases. See D-010.)
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
- D-010: A command rail keyed on argv[2] is blind to global options, and an
  unconditional rail on a *runner* blocks legitimate work. Both shipped in
  `scripts/command-guard.sh` and were caught by fresh-context rule review, not
  by 35 passing self-test cases: `git -C <path> push --force`,
  `git --no-pager push --force` and `npm --prefix ./sub install` all sailed
  through, while `env FOO=bar <cmd>` — a command prefix that dumps nothing — was
  denied (it cost the reviewer a probe script mid-review). Rules must resolve the
  first non-option operand, skipping flags and the values of flags that take one;
  and a dump rail must fire only on the bare dump. Corollary for self-tests: a
  matrix that only feeds the happy spellings measures nothing — include the
  hand-typed variants an agent actually produces, and exercise the entrypoint,
  not just the internal function.
- D-011: The command rail's one accepted false positive has a routine trigger:
  a heredoc body — a commit message, a patch script — whose line or clause
  *begins* with a blocked command reads as its own segment and is denied. It
  blocked a patch script and then the commit message describing the fix, twice
  in one unit. Not worth "solving" with quote-aware parsing (that is evasion
  territory, and the rail's threat model is mistakes). The working practice:
  write long commit bodies and patch scripts to a file in the scratchpad and
  pass the path (`git commit -F <file>`, `python3 <file>`), which keeps the
  trigger text off the command line entirely.
- D-012: The checkpoint invariant ("push at green before anything else") and the
  fresh-context review protocol ("no rule diff without a reviewer") read as a
  deadlock: hold the commit and a session death loses the unit; commit first and
  the history briefly carries an unreviewed rule change. The question came up
  three times in one session before being settled, which is the signature of a
  rule that was never written down. Resolution (owner, 2026-07-25): **the branch
  is the gate, not the commit.** Push at green, run the reviewer inside the same
  unit, land findings in a follow-up commit; a reviewable diff must never *merge*
  unreviewed. If a session dies in between, the outstanding review goes in the
  Owner queue. Expect two commits per rule unit — the reviewer usually finds
  something.
- D-013: Legislation must be **edited**, never appended to. Patching a rule by
  adding a paragraph beside the sentences it supersedes leaves both readings
  binding, and a later session picks whichever it reads first. Three instances
  in one session, each caught by a human or a fresh-context reviewer rather than
  by the author: the subagent ban carved out in one of three places; the
  `CLAUDE.md` sanction paragraph naming a rail that had been deleted in the same
  change; and the checkpoint/review ordering added as a new paragraph while the
  old "record the verdict in the commit body" sentence still implied the
  opposite. Before adding a rule, grep for every sentence stating the rule it
  replaces — including in `docs/BACKLOG.md` and the tripwire enumeration — and
  rewrite them in the same change. The authoring context is the worst placed to
  notice the contradiction, which is why this keeps reaching review. Same root
  cause at a different altitude: D-014.
- D-014: A rule can be obeyed perfectly at one altitude and never applied at the
  one above it. Branch-per-change is binding here, and on 2026-07-25 every *unit*
  followed session discipline exactly — ladder green, changelog line, commit,
  push — while the *branch* silently accumulated four independent changes (a
  provider fix, a lint cleanup, a command rail, a harness adoption) because each
  new request was treated as another unit on the current branch. PR #215 became
  ~1,200 lines the owner could not merge or revert piecewise; the owner accepted
  it as a one-time exception and the rule stands. The operational fix: **cutting
  the next branch from `main` is part of STARTING a unit, not part of finishing
  one.** When a session is asked for something that is not a continuation of the
  work in flight, that is a new branch, not a new unit.
- D-015 [cited]: Adopting an upstream harness SUBTRACTS as well as adds, and the
  subtractions are silent. AMH v2.1.0's shipped `command-guard.sh` overwrote this
  repo's hand-rolled one and carries four rails where ours carried five — the
  registry-install rail is this project's rule, not a harness-universal one, so
  nothing upstream knew to keep it. Installing cleanly and reading a green ladder
  would have dropped the tripwire the entire supply-chain section rests on, with no
  guard anywhere able to notice: the rail's absence is not a failing test, it is a
  test that no longer exists. Two things follow. **Diff what an install REPLACES,
  not just what it adds** — every overwritten file is a possible deletion of
  behaviour. And when a local rule survives an upstream file's replacement, it goes
  beside the shipped artifact (`scripts/install-guard.sh`, a second `PreToolUse`
  hook) rather than back inside it, with its own guard under `scripts/guards/` so
  the next upgrade cannot silently take it again.

- D-016 [cited]: An upgrade's changelog Upgrading notes are the complete list of what
  you must DO, not of what has changed under you. AMH v4.2.0 ships
  `LEDGER_ROW_CHAR_CAP` in `amh.conf.example` and enforces it in `scripts/ladder.sh`,
  and no Upgrading section across 2.1.1→4.2.0 mentions the key at all. It needed no
  note by the harness's own logic — the script defaults it to 2000, so a tree that
  never sets it is already compliant — but that logic silently makes an unset key a
  live constraint. Contrast `REQUIRED_TOOLS` / `ADAPTER_FILES`, where absent means the
  feature is OFF. The key-set diff in the upgrade procedure lists keys you do not set;
  it cannot tell you which of those still bind you. So: after a harness upgrade, run
  the diff AND grep the new scripts for each unset key to see whether its default is
  inert or enforcing, and set the enforcing ones explicitly — a rule that binds every
  future row belongs where this repo can read it, not only in a shipped script's
  variable block. Generalises D-015 (an install SUBTRACTS silently) to the other
  direction: an upgrade can ADD a binding rule silently too.
