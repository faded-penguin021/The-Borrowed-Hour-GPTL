# AMH v1.8 adoption — gap analysis and staged plan

**Owner-approved 2026-07-25** (P16: plans die at the end). Created when the
owner supplied Agentic Maintenance Harness v1.8; this repo had been running an
unversioned subset since 2026-07-18. **Segments 1–3 are shipped and all five
owner forks are resolved** — only segment 4 remains. Delete this file when the last segment lands — durable
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

## Segment 3 — ladder guards (SHIPPED 2026-07-25)

Shipped: STATE hysteresis (9 / 14 / 16 KB) with the landing check that fails a
trim landing in the debounce band; STATE structure guard; ledger rollover warn +
fail, duplicate-row detection, and bidirectional `[cited]` citation integrity.
Failure paths were exercised by hand (D-007 — and that is exactly why the
fixture suite in 4b is not optional). Still to do there: the local-only
checkpoint and rule-review tripwires.

## Segment 4a — generalize the command guard (SHIPPED 2026-07-25)

Shipped as `scripts/command-guard.sh`: agent-neutral (`--command`, PreToolUse
JSON on stdin, `--self-test`), covering all four hard rails with instructive
deny reasons, `.claude/` reduced to wiring, the static deny list kept beneath it
as the second net, and 56 self-test cases wired as a ladder rung. The JS hook it
supersedes is deleted. Rails now resolve the real subcommand past global options
(D-010), so `git -C path push --force` and `npm --prefix x install` are caught.

## Segment 4b — agent-neutral bootstrap + guard fixture suite (REMAINING)

Move `.claude/hooks/session-start.sh` to `scripts/session-start.sh`, self-locating
its repo root, remote-only steps gated on an explicit neutral flag rather than
Claude-specific env vars; `.claude/` keeps a one-line wrapper. Add
`scripts/test-ladder-guards.sh` (fixture suite for the guards themselves).

## Owner forks — ALL RESOLVED 2026-07-25

1. **Review protocols vs no-subagents** → glue review and rule review with a
   fresh context are the sanctioned exception; one blocking, sequential reviewer
   inside the unit. Ledgered as D-004.
2. **Adopt `docs/LEDGER.md`?** → yes, as long-term storage, with machine-verified
   bidirectional `[cited]` markers. Shipped.
3. **Merge mode** → branch-per-change. Written into `CLAUDE.md` → Git rules.
4. **Server-side rails** → the owner is adding them to the repo directly. Tracked
   as a Pending owner action, not agent work.
5. **STATE thresholds** → adopt the v1.8 band; it avoids micro-trimming. Shipped
   as 9 / 14 / 16 KB plus the landing check (D-005).

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
