# AMH v1.8 adoption — gap analysis and staged plan

**Provisional** (P16: plans are owner-approved and die at the end). Created
2026-07-25 when the owner supplied Agentic Maintenance Harness v1.8. This repo
had been running an unversioned subset since 2026-07-18. Segment 1 is shipped;
the rest are staged. Delete this file when the last segment lands — durable
content must by then live in `CLAUDE.md`, `docs/STATE.md`, and git history.

Sequencing rule: segments run one per sitting, ladder-green → commit → push,
per `CLAUDE.md` → Session discipline. Do not batch them.

## Already satisfied before v1.8 arrived

Ground-truth hierarchy (P1); working memory with a machine-enforced cap (P2, in
part); one verification entrypoint shared with CI, `--guards-only` fast path
(P4); checkpoint invariant and sequential units (P5); ask-don't-assume with an
Owner queue (P8, P9); Decided non-items (P10); permission deny rails +
instructive `PreToolUse` guard (P13, in part); process-docs-are-code (P15);
secret hygiene less the leak protocol (P17, in part); verification disclosure.

## Segment 1 — constitution (SHIPPED 2026-07-25)

Version stamp; instruction hierarchy (P18) as its own section; leaked-credential
protocol (P17); bounded recovery — the second-retry stop (P7); canonical-file
rule + `AGENTS.md` pointer; agent-harness section.

## Segment 2 — generalize the command guard (agent-side, no fork)

`.claude/hooks/block-npm-install.mjs` already implements P13's pattern rules
(segment-wise leading-command matching, mistake-not-evasion threat model,
fail-open, self-test). Widen it to the other hard rails — force-push, pushes
targeting `main`, env/secret dumps — so those get an instructive, self-correcting
deny reason instead of a mute prefix-match denial, and move it to
`scripts/command-guard.sh` with `.claude/` holding only the wiring. Keep the
static deny list beneath it as the second net. Wire its self-test as a ladder
guard rung so a regressed rail fails the build.

## Segment 3 — ladder guards

STATE length hysteresis (compress-to / warn / hard, plus the landing check that
fails a micro-trim landing in the debounce band); STATE structure guard (fail on
a missing required header, warn if the Owner-queue header vanishes); local-only
advisories — checkpoint tripwire (code changed vs `main` but STATE.md not in the
diff) and rule-review tripwire (uncommitted diff touches a legislation file).
Each guard lands with a fixture test.

## Segment 4 — agent-neutral bootstrap

Move `.claude/hooks/session-start.sh` to `scripts/session-start.sh`, self-locating
its repo root, remote-only steps gated on an explicit neutral flag rather than
Claude-specific env vars; `.claude/` keeps a one-line wrapper. Add
`scripts/test-ladder-guards.sh` (fixture suite for the guards themselves).

## Owner forks — blocked, do not decide these agent-side

1. **P12's review protocols vs this repo's no-subagents rule.** v1.8 mandates a
   *fresh-context* reviewer for glue diffs, and for binding-rule diffs mandates
   the strongest tier **with no self-review fallback** — a harness that cannot
   spawn a fresh context "parks the rule change for the human." This repo bans
   parallel subagents outright (`CLAUDE.md`, and it predates v1.8). The two
   cannot both hold as written. Note the immediate consequence: **Segment 1 is
   itself a rule diff**, so under a full adoption it wants a human read rather
   than my own review. Options: (a) carve out "one blocking, sequential review
   subagent" as compatible with the sequential rule — v1.8 argues exactly this;
   (b) keep the ban and route all rule diffs to the owner; (c) keep the ban and
   accept self-review for glue diffs only. Recommendation: (a), with the reviewer
   explicitly sequential and blocking.
2. **Adopt `docs/LEDGER.md`?** v1.8 makes the append-only ledger central (code
   cites `D-NNN`, `[cited]` markers, rollover, a citation-integrity guard). The
   owner deferred it on 2026-07-18 — "add the first time a durable cross-session
   lesson has no home." v1.8 is new evidence for re-opening, and Segments 2–4
   would generate ledger-worthy rows. Recommendation: adopt when Segment 2 lands,
   seeding it with the rule-collision above.
3. **Declare the merge mode.** v1.8 wants branch-per-change vs branch-train
   stated explicitly. Practice here is branch-per-change (squash, one commit per
   branch). Recommendation: write it down as-is.
4. **Server-side rails (owner-only).** Branch protection on `main` (PRs required;
   force-push and deletion blocked) and secret-scanning push protection. Agent
   rails bind only agents that load them; the server binds every actor.
5. **STATE thresholds.** Current guard is warn 8 KB / fail 16 KB with no
   compress-to floor and no landing check. v1.8 suggests a 9/14/16-shaped band.
   Changing them reshapes how often the owner sees compression churn.

## Deliberately not adopted (with reasons)

- **`scripts/redact.sh` as an output filter.** v1.8 says to be honest per adapter:
  this harness has no output-rewriting hook, so the filter would only ever be
  piped manually. Prose + deny rails remain the real layers. Revisit if an
  output-filter hook appears.
- **Separate `docs/RUNBOOK.md`.** v1.8's own adaptation note says small repos
  fold the runbook into the constitution and split only when playbooks multiply.
  One playbook exists (`docs/dependabot-triage.md`). Keep it folded.
- **P19 reference oracle.** No oracle exists — this is not a port or a rebuild.
- **P20 falsifiable doc-facts.** Incident-only admission by design; no prose
  claim here has drifted yet. Do not add speculatively.
