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
Vitest (unit) + Playwright (e2e), ESLint 10, Node 24 in CI. Shipped and deployed
to GitHub Pages from `main` (`.github/workflows/pages.yml`).

## Current state

**Shipped and in maintenance.** The 2026-07 audit + hardening pass (units U0–B7,
follow-ups F1–F2) and the improvement phase (H / T / E / P) are all `done` —
`docs/BACKLOG.md` is the full record, git history is the detail. The maintenance
harness (STATE.md, `scripts/ladder.sh`, session discipline, deny rails) shipped
in #208. No active multi-unit work.

Active branch `claude/deps-eslint-majors`: takes the two coupled Dependabot
eslint majors together — eslint 9→10 and eslint-plugin-react-hooks 5→7 (eslint
10 can't install under the plugin's old peer cap; the plugin's v7 `recommended`
adds new erroring rules). `eslint.config.js` now pins the two classic react-hooks
rules explicitly instead of spreading `recommended`, so the lint surface is
unchanged and no behavior-sensitive refactor is forced by the bump.

Standing harness: `scripts/check-supply-chain.mjs` (the `guard`), `.claude/`
SessionStart hook + permission rails, and the `model-catalogue-refresh` repo
skill.

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
1. **Dependabot triage.** Merge `claude/deps-eslint-majors` (eslint 10 +
   react-hooks 7, ladder-green) and **close #206/#207 as superseded** — they are
   the same two bumps split apart, and neither passes alone (they're coupled).
   PRs **#204** (actions/setup-node 7) and **#205** (npm minor/patch group) are
   already green — merge as-is.

**Open questions:**
1. **Adopt eslint-plugin-react-hooks v7's new rules now, or as a dedicated
   unit?** v7's `recommended` adds `react-hooks/set-state-in-effect`,
   `react-hooks/immutability`, and friends — ~34 findings across existing hooks.
   This bump keeps them off to stay surgical. Recommendation: **defer to a
   dedicated backlog unit** — several findings are effect-timing/behavior
   sensitive (setState-in-effect) and deserve per-site review + tests, not a bulk
   change bundled into a dependency bump.

**Incoming findings:** (none)

## Decided non-items (don't re-litigate without new evidence)

- **No backend of this project's own.** All state lives in the browser; keys go
  straight from browser to provider (users may point at their own BYOB proxy,
  which is theirs, not ours). Architectural invariant — see `THREAT_MODEL.md`,
  `CLAUDE.md`, `README.md`.
- **Saves & chronicles are local plaintext, not encrypted** (2026-07-16, commit
  `48712bd`). Deliberate: they hold story state, not secrets. Only API keys are
  encrypted at rest. See `THREAT_MODEL.md`.
- **`docs/BACKLOG.md` stays the forward backlog** (owner, 2026-07-18) — not
  archived, even with every unit `done`; STATE.md carries current state + the
  Owner queue. Revisit only if a large `done` tail crowds out live units.
- **No formal `docs/LEDGER.md` yet** (owner, 2026-07-18) — deferred. Add the
  numbered append-only ledger the first time a durable cross-session lesson has
  no home in BACKLOG or `docs/audit-2026-07.md`, and reconcile the audit doc in
  then.

## Changelog

One line per shipped change or completed unit (newest first). Pre-harness
history lives in `docs/BACKLOG.md` and git.

- 2026-07-18 — Take the coupled Dependabot eslint majors together: eslint 9→10 +
  eslint-plugin-react-hooks 5→7; pin the classic react-hooks rules in
  `eslint.config.js` so v7's new rules don't newly gate. Ladder green. New v7
  rules deferred (Owner queue). Supersedes #206/#207.
- 2026-07-18 — Harness v3 secret-hygiene pass: `CLAUDE.md` Secret hygiene section
  + verification-disclosure rule; `env` / `printenv` / `.env`-read deny rails in
  `.claude/settings.json`. Owner resolved both open questions (keep BACKLOG,
  defer LEDGER) — recorded under Decided non-items.
- 2026-07-18 — Add the maintenance harness: `docs/STATE.md`, `scripts/ladder.sh`
  (single verification entrypoint, STATE-length guard), CI wired to invoke it,
  session-discipline playbook folded into `CLAUDE.md`, force-push / push-to-main
  deny rails, and SessionStart branch check + protocol pointer.
