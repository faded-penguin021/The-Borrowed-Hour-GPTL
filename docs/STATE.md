# STATE — project state & session memory

> **Length guard (read before editing).** Steady-state target ≤ 8 KB. **If this
> file exceeds 16 KB, aggressively compress before committing:** collapse each
> completed unit into one Changelog line, delete narrative prose, and push
> durable detail down to git history + `docs/BACKLOG.md`. The **Project**,
> **Current state**, and **Owner queue** sections must always survive
> compression (Owner-queue items are the owner's to close — compress their
> prose, never drop an open item). `scripts/ladder.sh` machine-checks this:
> warn > 8 KB, fail > 16 KB.

## Project

The Borrowed Hour — a fully client-side, single-page literary text adventure.
No backend: players bring their own API keys and the browser talks straight to
LLM / image / TTS providers. Vite 8 + React 19 + TypeScript (strict), Tailwind 4,
Vitest (unit) + Playwright (e2e), ESLint 9, Node 24 in CI. Shipped and deployed
to GitHub Pages from `main` (`.github/workflows/pages.yml`).

## Current state

**Shipped and in maintenance.** The 2026-07 audit + hardening pass (units U0–B7,
follow-ups F1–F2) and the improvement phase (H / T / E / P) are all `done` —
`docs/BACKLOG.md` is the full record, git history is the detail. No active
multi-unit work.

Standing harness: `scripts/check-supply-chain.mjs` (the `guard`), `.claude/`
SessionStart hook + permission rails, and the `model-catalogue-refresh` repo
skill. This branch adds the maintenance harness itself — `docs/STATE.md` (this
file), `scripts/ladder.sh` as the single verification entrypoint (CI invokes it
directly), the folded session-discipline playbook in `CLAUDE.md`, and the
force-push / push-to-`main` deny rails.

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
1. Merge this harness branch (`claude/implement-harness-8kvhax`) into `main` via
   squash-merge when satisfied. Tagging/releasing stays an owner step.

**Open questions:**
1. **`docs/BACKLOG.md` — every unit is `done`. Keep it as the forward tracker,
   or archive it?** Recommendation: keep BACKLOG.md as the append-a-unit backlog
   (its unit protocol already matches this harness) and let STATE.md carry
   *current* state + the Owner queue; revisit archiving only if BACKLOG grows a
   large `done` tail that crowds out live units.
2. **Adopt a formal append-only `docs/LEDGER.md` now, or defer?** The harness
   template defers the ledger until a past mistake is being re-explained; this
   repo already has `docs/audit-2026-07.md` (a de-facto discovery log) and
   BACKLOG's inline `done`-notes filling that role. Recommendation: **defer** —
   add the numbered ledger the first time a durable cross-session lesson has no
   good home in those two files, and reconcile the audit doc into it then.

**Incoming findings:** (none)

## Decided non-items (don't re-litigate without new evidence)

- **No backend of this project's own.** All state lives in the browser; keys go
  straight from browser to provider (users may point at their own BYOB proxy,
  which is theirs, not ours). Architectural invariant — see `THREAT_MODEL.md`,
  `CLAUDE.md`, `README.md`.
- **Saves & chronicles are local plaintext, not encrypted** (2026-07-16, commit
  `48712bd`). Deliberate: they hold story state, not secrets. Only API keys are
  encrypted at rest. See `THREAT_MODEL.md`.

## Changelog

One line per shipped change or completed unit (newest first). Pre-harness
history lives in `docs/BACKLOG.md` and git.

- 2026-07-18 — Add the maintenance harness: `docs/STATE.md`, `scripts/ladder.sh`
  (single verification entrypoint, STATE-length guard), CI wired to invoke it,
  session-discipline playbook folded into `CLAUDE.md`, force-push / push-to-main
  deny rails, and SessionStart branch check + protocol pointer.
