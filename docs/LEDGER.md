# DEVIATIONS & DISCOVERIES LEDGER — permanent registry (D-001…)

> **Append-only retrieval storage — NEVER archived, compressed, or truncated.** This is the
> canonical, permanent home for every numbered deviation and discovery. Append rows at the
> bottom in one continuous sequence; never move, renumber, summarize or delete them. **Grep it
> and cite one row, never read a volume whole** — a volume at its cap is tens of kilobytes
> whose overwhelming majority is irrelevant to any given session. Code and committed tests
> settle current behavior; a stale row remains historical.
>
> **Rows are immutable.** The ` [cited]` marker is metadata and may be synchronized in place —
> the one exception, and a required one, because the ladder's citation rung checks that marker
> in both directions and an append-only guard of your own must permit adding AND dropping it.
> Otherwise correct a detail with a new row and append `Corrected by D-NNN.` to the old row, or
> replace its whole conclusion with a new row and append `Superseded by D-NNN.` A row carries
> at most one pointer, ever, and the first is final.
>
> **All of that is PROSE-ONLY in this repository.** This repo ships no append-only guard: the
> ladder never reads a committed row for edits, so nothing stops an in-place rewrite, checks
> pointer form, or tells an honest `Corrected by` from a dishonest one. The upstream harness
> assumes such a guard and its wording elsewhere may read as though one exists here. It does
> not — these rules are held by the author and the rule reviewer or not at all.
>
> **Authoring.** Search the volume chain before appending — extend or cite an existing row
> rather than add a near-duplicate. Write the smallest self-contained durable lesson, one or two
> sentences where they suffice; route debugging narrative to git and leave a concise pointer.
> `LEDGER_ROW_SENTENCE_CAP` is the working limit and `LEDGER_ROW_CHAR_CAP` the backstop beneath
> it (both in `amh.conf`, deliberately not restated here as numbers). They are **rejection
> boundaries, never desired sizes**: crossing either rejects the row, and passing them proves no
> more than the absence of obvious oversizing — never concision, scope or information quality.
> Approaching one is a classification signal that the material holds narrative or two lessons:
> split it or reduce it to the durable conclusion. **Never merge sentences, repunctuate, or drop
> useful qualifiers solely to move a counter.** That last rule is prose-only too: no guard can
> tell a split lesson, a pre-truncated one or a repunctuated one from a genuinely short row.
>
> **What the boundaries actually reach.** They bind every row still *uncommitted* when the
> ladder runs — the rung returns early unless the ledger has uncommitted changes, and skips any
> row ID already present at HEAD. Committing first and verifying afterwards escapes them
> entirely, and rows already in history are exempt permanently. One more reason the checkpoint
> invariant runs ladder-green *before* commit rather than after.
>
> **Paths in rows.** A row's immutability covers its text, not the lifetime or location of a
> file it names. A new path reference must resolve in the tree where the row is authored; a
> committed row's target may later move or disappear, and that historical drift leaves the text
> alone and blocks nothing. **A new row may not cite a plan's path** — a plan is provisional
> context whose citation dies when it retires, and a row that pinned one would make
> archive-or-delete impossible.
>
> **Rollover.** `LEDGER_LINE_CAP` is a rollover boundary on LINES for this whole file, not on
> rows and not the same unit as either row boundary above. The final row may finish past it, but
> no row may ever *start* past it: when the file stands over the cap, create `LEDGER_A.md` with
> this same header, numbering from **DA-001**. The suffix advances as an **odometer over A–Z,
> not a list with a last entry**: `_Z` rolls to `_AA`, `_AZ` to `_BA`, `_ZZ` to `_AAA`, without
> limit. The ladder computes that name and prints it in the failure telling you to roll over, so
> you never spell it yourself. The live volume's byte size is measurement only — reported, never
> judged, and once this file rolls over its size stops being reported at all.
>
> **The volumes form a CHAIN, and the ladder walks it from `LEDGER.md`, stopping at the first
> missing link.** A volume is a file the scheme can *reach*, not one whose name looks right: a
> `LEDGER_X.md` with no `LEDGER_A.md`…`_W.md` before it is unreachable and its rows are read by
> nothing. The rung warns naming the unreachable file, and fails outright if `LEDGER.md` itself
> is the missing one.
>
> **`[cited]` (machine-CHECKED — you write it, the ladder verifies it).** A row cited from the
> configured code/workflow scan paths carries ` [cited]` after its number. `scripts/ladder.sh`
> checks it both ways — cited-but-unmarked and marked-but-uncited each fail — but it never edits
> this file: **nothing syncs the marker for you.** What it checks is token sync and row
> existence, never that the row actually *supports* the claim at the citation site; that is the
> rule reviewer's job (`docs/RUNBOOK.md` → Fresh-context review). Documentation mentions are
> existence-checked by this repo's own `scripts/guards/docs-citations.sh` and never carry the
> marker.

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

- D-017: A mutation test proves a VECTOR fires, not a rule. G1's ledger tests passed
  with the id odometer removed: rollover runs after every id in an append is already
  assigned, so within one call `rolled` is still 0 and an id scheme ignoring it looks
  identical. The vector filled the ledger in a single call and so could never reach the
  case. The failure only appears on the NEXT append, where the naive scheme reuses a
  live id. So when mutating a guard to prove it fires, check that the vector exercises
  the state the mutation changes — a green mutant means the test missed the case, not
  that the rule is redundant, and deleting the "unnecessary" code would have shipped
  colliding ids. Sharpens D-007: prove a guard fires AND that the proof reached the
  branch under test.

- D-018: Adding a field to a payload TYPE does not wire it, and TypeScript cannot say
  so — an unread field is legal. `LoadSavePayload` gained `ledger`, `gameLoop` passed
  it, the `LOAD_SAVE` case never read it: loading save B kept save A's permanent memory
  and the next write persisted A's rows into B's record. Typecheck was green, and so was
  the new test, whose fixture put an EMPTY ledger in the payload and asserted nothing
  about the result. So: when a payload grows a field, grep the consumer for it rather
  than trusting the build, and give the fixture a value DIFFERING from the prior state,
  so "kept the old" and "applied the new" cannot both pass.

- D-019: Model-authored text rendered into a prompt block can forge the BLOCK'S OWN
  STRUCTURE. A story-ledger row is emitted one per line and the frozen chronicle is
  split on newlines, so a row whose text carried "\n  L-099 [RULED OUT] ..." wrote
  itself a second row with an invented id, and folded into two chronicle entries its
  own key could never match again — killing dedupe for that fact permanently, in a
  tier that is by design irreversible. Clamping length and trimming ends does not
  reach it. So: when a model-written string is rendered into a structured block the
  model reads back, the block's delimiters must be UNREACHABLE from inside the value
  (flatten at producer and loader), not discouraged in the field description.

- D-020: A lossy fold must keep the fields the reader's SEMANTICS depend on, not just
  the ones it displays. Rollover folded a ledger row as bare `r.text`, dropping `kind`,
  so a row recorded as `ruled_out` ("Mara is the informant" — meaning she is NOT) came
  back after rollover as an established fact. The live block marked polarity and the
  chronicle did not, so the tier inverted the exact rows it exists to hold, at around
  the turn count its own prompt promises it will help. Negative memory is the half that
  degrades silently: an established fact folded to text is still true, a ruled-out one
  becomes its own opposite. Check a compaction step against every field the CONSUMER
  interprets, and keep dedupe keyed on the fact rather than the rendered line.

- D-021: The pre-AMH harness history, relocated out of `CLAUDE.md` on the v14.0.0 upgrade
  under AMH 8.0.0's rule that the constitution states the system as it is now. A
  hand-rolled v1.8 rule subset was added 2026-07-18 and hardened 2026-07-25; the AMH
  v2.1.0 instantiation of 2026-07-27 superseded it and was owner-sanctioned in full; the
  v4.2.0 upgrade of 2026-08-09 carried that sanction forward, adding `REQUIRED_TOOLS`,
  `ADAPTER_FILES` and `LEDGER_ROW_CHAR_CAP` to `amh.conf`.

- D-022: The `PreToolUse` rail lineage, relocated with D-021. `.claude/hooks/block-npm-install.mjs`
  (deleted 2026-07-25) was superseded by a hand-rolled four-rail `command-guard.sh`, which the
  shipped AMH guard replaced on 2026-07-27 with its install rail moving to this repo's own
  `scripts/install-guard.sh`. Each swap was owner-sanctioned; an unexplained hook change is
  still a stop-and-report event.

- D-023: AMH v14.0.0 adopted 2026-09-05 from v4.2.0, twenty-one releases in one pass,
  owner-sanctioned in advance. Two forks were decided by the session rather than queued, both
  flagged back to the owner: `LEDGER_ROW_CHAR_CAP` went 800 back to the shipped 2000 because
  8.0.0's new `LEDGER_ROW_SENTENCE_CAP` now does the job 800 was standing in for, and the
  `light` profile was kept rather than splitting a `docs/RUNBOOK.md`. Corrected by D-028.

- D-024: An upgrade note that names a seed file this profile does not carry needs a written
  destination, not a judgement call each time. Five AMH releases route legislation into
  `docs/RUNBOOK.md`, which the `light` profile withholds; the content must still land somewhere
  live, uncapped and inside `RULE_FILES`, which here is `CLAUDE.md`. Record the mapping in the
  constitution so the next upgrade does not re-derive it — or re-decide the split deliberately. Corrected by D-028.

- D-025: Writing rule prose ABOUT the credential rails trips them. The command guard's dotenv
  and certificate-container advisories match the filename shapes anywhere in a command, so a
  heredoc carrying constitution text about them is blocked exactly as a read would be. Both are
  one-time speed bumps and the rerun proceeds, which is the designed answer; the cost is one
  turn each. Do not reword the rule to dodge the scanner.

- D-026: An out-of-band owner instruction that authorizes a deviation must be written into the
  tree at the moment it is used, with its date and its wording. The 14.0.0 upgrade decided two
  owner-grade forks under a spoken "decide forks on your own"; the fresh-context reviewer, which
  by design cannot see the session, correctly read that as a governance rule invented from
  nowhere and made restoring the reversed value its top finding. The authority was real and the
  audit trail was not, and only the second is checkable.

- D-027: A scripted edit that asserts one string is present and then rewrites a DIFFERENT one
  reports success while changing nothing. A review finding was recorded as fixed on the strength
  of a passing assert whose guarded string was never the replacement's target — the indentation
  differed by two spaces — and the claim reached a commit body. Assert on the post-condition, not
  the pre-condition: compare the buffer before and after and fail when they match. This is the
  concrete cost of the constitution's preference for a visible diff over an opaque interpreter edit.

- D-028: The owner reviewed the 14.0.0 upgrade on 2026-09-06 and overturned both forks the
  upgrading session had decided. `LEDGER_ROW_CHAR_CAP` is 1400, on the test that a cap becomes
  the target over time: the shipped 2000 could not be promised to stay a ceiling, and the old
  800 rejects a sentence-compliant 1030-byte row on bytes and so restores the shaving reflex.
  `docs/RUNBOOK.md` was split out of a 616-line constitution, so runbook-routed content now has
  its own home rather than landing in `CLAUDE.md`. Corrects D-023 and D-024.

- D-029: A one-time owner grant is recorded, never generalised. On 2026-09-05 the owner
  authorised a single session to decide forks alone; it was used for the two forks D-028
  reverses, and the owner ruled on 2026-09-06 that such a grant is never durable and must not
  become a rule in `CLAUDE.md`. It is kept here rather than in working memory because a
  deviation whose authority leaves no audit trail cannot be told from an invented one (D-026),
  and `docs/STATE.md` is compressed and would lose it.

- D-030: Moving prose between documents changes what its deictic words mean. Relocating whole
  sections from the constitution to `docs/RUNBOOK.md` was done verbatim on the reasoning that
  only the address changed, and that reasoning is wrong for any sentence saying "this file",
  "below", or "see <section>": the rule requiring process docs to be fixed in the same change
  silently narrowed from the constitution to the runbook. When relocating, grep the moved text
  for self-reference and rewrite each one to name its target explicitly.
