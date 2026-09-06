# RUNBOOK — maintenance playbook

Operational detail for this repository. `CLAUDE.md` is the constitution: it states the rules
that bind and points here for how to carry them out. **This file is the authoritative source
for every procedure it describes**; where the constitution names one of these rules in passing,
that is a signpost for a session that must know it before acting, and this file wins on the
detail. **Moving text between them is legislation, not tidying**, and takes the rule-review
protocol — including a check that no moved sentence still says "this file" of its old home
(D-030). Both files are in `amh.conf`'s `RULE_FILES`.

This file is read on demand rather than on every turn. That makes it the right home for
procedure — the steps, the checklists, the reasoning behind a threshold. It does NOT mean the
rules here bind less: **Session discipline** below is binding on every session, and the
constitution's Session protocol sends you here before you start work for exactly that reason.
What must never live here is anything a session needs *without* being told to look, which is
why the constitution keeps the rule and leaves the procedure to this file. Nothing here is
history: superseded rules and per-version narratives go to `docs/LEDGER.md`.

## Reference-doc index

- `docs/STATE.md` — working memory. Protocol step 1 of every session, Owner queue included.
- `docs/LEDGER.md` — permanent, append-only memory. Grep one row; never read a volume whole.
- `docs/BACKLOG.md` — the forward backlog and its unit protocol.
- `docs/dependabot-triage.md` — red Dependabot CI, triaged by failure shape.
- `docs/audit-2026-07.md`, `docs/wiki.md`, `docs/model-catalogue-maintenance.md` — as named.
- `THREAT_MODEL.md`, `CONTRIBUTING.md`, `README.md` — source of truth for anything not covered
  by the constitution.

## Acceptance ladder

**Verify with `scripts/ladder.sh`** (or `npm run ladder`, which invokes it) —
the single entrypoint CI runs too, so local-green and CI-green can't diverge.
Guards first, all of them, in seconds: `docs/STATE.md` size band + required
sections, ledger rollover, code↔ledger citation integrity, the secret-shape scan
(`scripts/redact.sh` **is** the scan — the filter is run over every text file),
commit-message poison tokens, git author identity, new-ledger-row lengths (both the
sentence and byte boundaries), the shipped rails' self-tests,
shipped-script integrity against the manifest, then this repo's own guards under
`scripts/guards/`. Then rung 3, `scripts/verify.sh`: supply-chain guard →
typecheck + lint → unit tests + coverage → build → the ladder's own guard fixtures.
`scripts/ladder.sh --guards-only` is the seconds-long path for docs-only work.
Unlike the pre-AMH ladder, guards **do not stop at the first failure** — one run
gives one complete report, so read past the first `FAIL`.
Playwright e2e is a separate CI job (locally needs `PW_CHROMIUM`, which the
SessionStart hook exports); run it when a change touches the game flow.

**A green rung deliberately does not print its thresholds**, and that is not
information lost. A healthy size line states the size and that it is within the band,
naming no threshold; a completed
compression landing reports how far *clear of* the ceilings it landed rather than
naming them; the ledger rung reports each new row's own sentence count. Every WARN and
FAIL still quotes the threshold it turned on, because a rejection has to say what it
rejected against. Read a threshold from `amh.conf`, which is where it is authoritative
— **a number the ladder printed is never a value to copy back into prose**, and prose
that restates a threshold as a digit drifts silently the first time the key moves.

## When CI fails (workflow vs code)

The local ladder and CI run the same script, but
the commit, index and worktree are inputs too: a guard built on `git ls-files` may omit
an untracked file, so staging it after the local run changes what CI receives and turns
local-green into CI-red with no environment difference. Triage: (1) read the failing
log; (2) reproduce from the exact tree state CI checked, staging new files before the
local ladder when a guard's file discovery is index-dependent; then classify a real
failure (fix the code), a toolchain mismatch (fix the workflow, in the same PR), or a
flake (re-run once; never "fix" code for a flake). (3) Never weaken a gate to get green.
(4) Real but out of scope: say so, with the log excerpt.

## Session discipline (binding for every session)

Assume the session can die at any moment (rate limit, context window, crash) and
that you are the last reviewer — there is no stronger pass behind you.

1. **Strictly sequential.** One unit of work at a time; no parallel subagents on
   this repo. **The one exception** (owner, 2026-07-25 — D-004) is a *review*
   subagent: the fresh-context passes below spawn a single blocking reviewer
   inside the unit. That is sequential work, not fan-out — the session still
   waits for it and triages every finding itself.
2. **Small, shippable units.** ≈ one focused hour, independently shippable, each
   with a **binary** acceptance check (`scripts/ladder.sh` green — never "looks
   right").
3. **Checkpoint invariant.** Every unit ends: ladder green → `docs/STATE.md`
   Changelog line → commit → push. Never start a second unit on top of an
   uncommitted first — an interrupt then loses only the unit in flight. A
   pending fresh-context review is **not** a reason to hold the checkpoint; see
   Fresh-context review for how the two compose (D-012).
4. **Ask, don't assume — route owner-judgment forks to the queue.** Forks that
   are (a) irreversible / expensive to unwind, (b) user-visible behavior with no
   spec to appeal to, (c) version-semantics ambiguous, or (d) process-reshaping
   are the **owner's**: stop at the last green checkpoint, record the fork +
   options + your recommendation under `docs/STATE.md` → Owner queue → Open
   questions, and move to independent work. Routine engineering judgment inside a
   unit's stated scope is *not* a fork. Genuinely unsure? Treat it as a fork —
   escalation costs one read, a wrong guess can cost a segment.
5. **The Owner queue is the human-in-the-loop channel.** It holds Pending owner
   actions (including any "review owed: <branch>" a session could not complete),
   Open questions (above), and Incoming findings (where the owner drops
   manual-test results). Every item carries a `Check:` that settles it from the tree or
   the world — test the check before restating the item, since an item whose check reads
   a squash-merged commit subject will report "still open" forever. Every session's
   **final chat message restates the queue** so the owner never has to open the file.
   **Plans under `docs/plans/` are provisional context and end archived or deleted**, with
   no redirect or tombstone left behind. A ledger row may therefore **never cite a plan's
   path**: permanent memory is immutable, so such a row would pin the plan in place
   forever. A committed row that already names one does not block anything — its
   immutability covers its text, not the lifetime of a file it names, and historical path
   drift is expected.
6. **Recovery is a protocol, not improvisation — and it is bounded.** If the unit
   in flight has gone wrong, reset to the last green checkpoint
   (`git reset --hard HEAD`, careful clean), re-run the ladder to confirm green,
   re-attempt smaller. Record a durable lesson before retrying. **If the same
   blocker survives a second reset-and-retry with no real progress, stop:** reset
   once more to green (never end a unit red), record the blocker in the Owner
   queue, commit/push so the record survives session death, and end the unit. A
   gate that won't go green is either a real fix you're missing (diagnose it,
   don't re-run it) or an owner fork — neither is solved by burning the window
   re-running a script. The stop is for a genuinely stuck blocker, not cover for
   abandoning a failure you could diagnose. Pushed checkpoints are immutable —
   never rewrite pushed history. The sole exception is a leaked credential, and
   even then the rewrite is owner-executed (`CLAUDE.md` → Secret hygiene, and **Incident: leaked
   credential** below).
7. **These process docs are code.** If `CLAUDE.md`, this runbook or `docs/STATE.md` is wrong,
   stale, or missing the case you just handled, fix it in the same change. That
   covers *operational* content; binding rules go through the rule review below.
8. **Verification disclosure.** Every commit body states what you actually
   verified (which ladder rungs ran) and names what could *not* be verified
   locally — for this repo that's Playwright e2e and any real-provider / on-device
   behavior (owner-verified via the Owner queue). Disclosure of real actions,
   never implied coverage.

## Working-memory compression

The rules for compressing `docs/STATE.md`. They live here rather than in the file they
govern, and that placement is the point: these rules change only under the rule-review
protocol, while the byte band on `docs/STATE.md` exists to force *volatile* content out. A
block of permanent rules sitting inside that band spends the budget every compression pass is
fighting for, and it cannot itself be compressed — folding a live rule is repeal. `docs/STATE.md`
keeps a pointer here; **that pointer is prose-only** — no guard checks it, so deleting it is
how a relocation quietly finishes becoming a repeal.

**Thresholds.** `STATE_WARN_KB`, `STATE_HARD_KB`, both post-action ceilings and
`STATE_EDIT_DELTA_BYTES` live in `amh.conf` and are deliberately **not** restated here as
numbers. In the 13.0.0 vocabulary: WARN and EDIT_DELTA are *triggers*, HARD is a *rejection
boundary*, and the two COMPRESS_TO keys are *post-action ceilings*. Boundaries decide when
machinery intervenes, never how much content an author should produce.

**Two ceilings, because neither works alone.** A landing must satisfy the byte ceiling AND
the sentence ceiling. A byte ceiling is reachable by shaving words, which removes no content;
a sentence ceiling is reachable by rewriting `. T` to `; t`, which frees no space. Each blocks
the cheap move that satisfies the other, and folding whole stages is what satisfies both at
once. **What this does not claim** is that the pair cannot be gamed: a rewrite that removes
the wrong content passes both, and no guard can see it.

**Counter acceptance is not a quality verdict.** Passing both establishes only that the
result is not obviously oversized — never concision, correct scope, or successful compression.
**Counter-only rewrites are forbidden:** never merge sentences, repunctuate, or remove useful
qualifiers solely to move a number.

**When.** Compress by lifecycle, not by file size: once a stage is complete, fold its
narrative and route its durable lessons to `docs/LEDGER.md` even while the file sits below the
compression trigger. The trigger only makes a pass *mandatory* before further substantive
work; a typo fix above it is allowed and still owes the pass.

**How far.** Keep only current state, unresolved Owner-queue items, immediate operational
gotchas and concise Changelog pointers. The configured values are acceptance ceilings, not
retention goals: there is no reward for keeping text because space remains, no preferred
landing size, and no need to add or reshape content to approach either ceiling. A
substantially smaller file is equally successful, and often better, when it retains everything
live.

**How.** Decide each fold by whether the stage is complete, never by proximity to a number.
Collapse completed stages into concise Changelog pointers, fold changelog clusters, move
durable lessons into the append-only ledger *before* deleting their narrative. Never shave
clauses until the guard goes quiet, and never cut text into another file — that is not
compression, it is relocation, and relocation is legislation. **Project**, **Current state**,
**Owner queue**, **Decided non-items** and **Changelog** must always survive — that is the
`STATE_REQUIRED_SECTIONS` set and the structure rung hard-fails on a missing or empty one.
Compress an Owner-queue item's prose, never drop an open one; closing one is the owner's call.
Moving any further passage out of working memory is likewise the owner's, one grant at a time.

**What may be in `Current state` at all — the content rule beside the size rule.** Three
categories, and only the first is unqualified truth there:

1. **Repository-controlled** — true of the checked-out tree until another repository change
   alters it: implemented behavior, the version the tree declares, tracked active work, the
   live ledger VOLUME (never its latest row id, which every append moves and no sentence
   follows). This is what `Current state` is for.
2. **World-controlled** — can change with no change to the tree: whether a branch merged,
   whether a remote tag or release exists, PR and CI status, deployments, remote branches,
   forge protection settings. **Never cached here as current truth.**
3. **Historical observation** — a past external fact kept because it is still useful, scoped
   in the sentence to when it was observed so it cannot read as present status.

Apply the test before writing a sentence: *would it still be accurate if this same commit were
cloned tomorrow, under another branch name, after forge state had moved?* If not, route it.
Where a live probe computes the fact, point at the probe rather than copying its output. Where
a session cannot inspect the setting (branch protection, a remote's configuration), state the
expectation without claiming to have observed it. Where the resolution is an external action,
it is an Owner-queue item with its `Check:`, not a sentence here. Two limits, so this is not
read wider than it is: the scope is `Current state` and does not reach the Changelog or the
ledger pointers, which are historical storage by construction; and it is **prose-only** — no
guard reads a State sentence for temporal validity, none is proposed, and none should be, since
the discriminator is meaning.

**What the ladder checks, and what it does not.** `scripts/ladder.sh` machine-checks the band,
the required sections and their non-empty bodies, that no level-2 heading appears twice, that
the Owner-queue heading is still there (a warning, not a failure — the section is the owner's),
and that a compression pass lands on the ceilings
rather than just clearing the warning; above the trigger it tells a pass from an ordinary edit
by how much the file shrank. **And that list is the whole of it** — a claim about
`guard_state_size` and `guard_state_structure` in a script that upgrades independently of this
file, so those two functions are the authority and this sentence is what goes stale. Everything
else here — what to fold, whether what survived is any good, whether you dropped an open
Owner-queue item — is prose no guard will catch you breaking.

**One consequence, since silence reads as approval: the landing check never runs below the
compression trigger.** Only a file that started above it reaches that check. So a deep pass on
a file already under the trigger draws a plain size line and nothing more — the absence of a
check, not a verdict that the edit was right. Do not reach for a threshold to cover it: it is
the SHRINK that is measured, and a check treating any large shrink as a compression pass would
fail a session for deleting one resolved Owner-queue item from a healthy file.

## Fresh-context review (the sanctioned subagent)

The context that wrote a diff is anchored on its own reasoning. Both passes below
therefore run in a **fresh context** — a subagent given the diff, the checklist,
and tree access, but *not* the authoring rationale. One level of meta only: the
reviewer reports, the session triages, the owner arbitrates. Nobody reviews the
reviewer.

**Order of operations: ladder green → commit and push → review → findings in a
follow-up commit.** The review does not block the checkpoint; the gate is the
branch **merging**, not the individual commit (D-012). Holding an uncommitted
diff while a reviewer runs is the worst of both — a session death then loses the
whole unit, which is what the checkpoint invariant exists to prevent. What must
never happen is a reviewable diff merging unreviewed, and that half stays
**prose-only**: no guard sees a merge, so the Owner-queue restatement is the only
thing carrying an owed review across sessions. What the harness *does* give you
is the front half — a local advisory that WARNs when an uncommitted
diff touches a path in `amh.conf`'s `RULE_FILES`, so a rule change cannot be typed
without the protocol being named. Note both of its limits before trusting it: it is
a warning, not a gate, and it is skipped in CI (it describes a working session, which
CI does not have). If a session dies between the checkpoint and the review, the branch is
carrying an unreviewed change: record it under **Pending owner actions** as
"review owed: <branch>" — it goes in front of the owner because only the owner
can decide to merge without it.
Expect two commits per reviewed unit — in practice the reviewer finds something
— and state the verdict in the body of whichever commit carries the outcome
("glue-review pass: clean", "rule-review pass: 2 findings, fixed").

**Glue review — for diffs touching what the tests can't see.** Unit tests here
don't cover browser/runtime glue: streaming and abort paths, storage and
encryption lifecycles, the ambience state machine, CSP/origin behavior, autoLock
timing. For those diffs, hand the full diff to a hostile reviewer hunting
concrete bug classes drawn from real shipped bugs (append new classes to
`docs/LEDGER.md` as they occur; retire any class that becomes a regression test —
this pass holds only what tests *cannot* see): stale async completions landing
after an abort, non-idempotent lifecycle (double-init, double-listener), gate
polarity, insertion order, observer echo races. Scale the reviewer's model tier
to the diff. Self-review is the fallback only if no fresh context can be spawned.

**Rule review — for diffs to this harness's legislation.** This is the canonical scope list;
the constitution points here rather than keeping a second copy. It covers **`CLAUDE.md`**, this
file, **`amh.conf`** (it holds every binding threshold and the scope lists the guards read —
config that decides a guard's behaviour is legislation), `docs/STATE.md`'s rule-bearing sections
(its pointers, its Decided non-items), `scripts/ladder.sh` and `scripts/guards/` semantics,
`.claude/` rails and hooks, and `docs/LEDGER.md`'s preamble. Strongest tier regardless of diff size — a
three-line rule edit can carry a semantic bomb — and **no self-review fallback**:
a session that cannot spawn a fresh context still checkpoints, then parks the
change **unmerged** and records "review owed" under Pending owner actions.
A bad rule manufactures defects in every future session that obeys it. Checklist:
rule contradiction with an existing binding rule (D-004 is the worked example),
prose/guard lockstep drift (a number in prose diverging from the guard constant
enforcing it), Goodhart-ability (satisfiable while defeating the intent — D-005),
enforcement asymmetry (prose implies a check no guard performs — then say
"prose-only" or add the check), citation validity (the cited row exists *and*
supports the claim — the half no guard can check), and agent-agnosticism
regressions. Routine `docs/STATE.md` edits are exempt: working memory, not
legislation.

## Supply-chain hygiene (read before touching deps or running installs)

The npm ecosystem has active self-propagating worms (Shai-Hulud, Miasma,
CanisterWorm and successors) that backdoor packages and, in Miasma's case,
**inject persistent instructions into AI-assistant config files like `CLAUDE.md`**.
Treat the following as hard rules:

1. **Use `npm ci`, never `npm install`**, unless the task is explicitly a
   dependency change. `npm ci` honors the lockfile; `npm install` will happily
   pull a freshly compromised minor. **This one is enforced, not advisory:** the
   `PreToolUse` hook `scripts/install-guard.sh` denies
   `npm|pnpm|yarn|bun install|i|add|update|upgrade`. Retrying or rephrasing a
   blocked command fails identically — for a genuine dependency-change task,
   prefix it `BORROWED_DEP_CHANGE=1` to opt in explicitly. The opt-out exempts
   only the command segment it prefixes. Cases:
   `scripts/install-guard.sh --self-test`, run every ladder run by
   `scripts/guards/install-rail.sh`. This rail is **repo-local**: AMH's shipped
   `scripts/command-guard.sh` carries the force-push, push-to-`main`, env-dump and
   `.env`-read rails and no install rail, because that rule is ours, not the
   harness's. Both hooks run on every Bash call.
2. **Any change to `package.json` or `package-lock.json` is a reviewable event.**
   If a task doesn't intend to touch them, and they show up in the diff, stop
   and surface it to the user.
3. **Flag any new `binding.gyp` file** appearing in the working tree or under
   `node_modules/` after an install. Miasma uses a ~157-byte `binding.gyp` with
   a command-substitution `action` to execute code without a lifecycle script.
4. **Flag any package that newly gains `hasInstallScript: true`** in the
   lockfile. The current legitimate ones are `esbuild` and `fsevents` only.
5. **Never add `axios`, `@ctrl/tinycolor`, `@duckdb/node-*`, or
   `@nativescript-community/*`** without a fresh check against current
   compromise advisories — these families have been hit repeatedly.
6. **Don't write or commit `.npmrc` files with auth tokens.** There is no
   private registry for this project.
7. **CI uses `npm ci` against the committed lockfile.** Don't change that.

## Incident: leaked credential

**If a secret has already escaped** (into a commit, a pushed branch, a log),
containment outranks the checkpoint invariant:

1. Stop normal work. **Never repeat the value again anywhere** — not in
   `docs/STATE.md`, not in chat, not in a diff. Refer to it by key name only.
2. Owner queue immediately: key name, where it landed (SHA / file / log), and the
   exposure window. Push nothing new that contains it.
3. **The owner rotates the credential first** — rotation is what ends the
   exposure; the value stays burned even after cleanup.
4. Only then does the owner decide whether a history rewrite is warranted. It is
   the one sanctioned exception to never-rewriting-pushed-history, scoped to
   removing the secret, and **executed by the owner, never by an agent** — the
   force-push deny rail stays in place for agents.
5. Afterward: record it, and if a guard or deny rail could have caught it, add
   one with a test.
