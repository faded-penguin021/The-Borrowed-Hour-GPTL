# Dependabot triage playbook

Dependabot opens PRs on a schedule and a few go red every round. The failures
fall into a small number of shapes, and each shape has one right response.
Start here instead of re-diagnosing from scratch.

`npm ci` is the only install command in CI and in these flows. Never reach for
`--force` or `--legacy-peer-deps` to make a red bump go green — see
`CLAUDE.md` → Supply-chain hygiene.

## First: read the failing rung

Every CI job runs `scripts/ladder.sh`, so the failing rung names the shape:

| Failing rung | Shape | Response |
| --- | --- | --- |
| `npm ci` (before any rung) | **Peer-range block** | Upstream-gated — Owner queue |
| `check` (eslint) | **Lint-rule fallout** | Fix the source, on a normal branch |
| `check` (tsc) | **Type-surface change** | Fix the source, on a normal branch |
| tests / build | **Real behavior change** | Own unit, own branch |

## Shape 1 — peer-range block

`npm error Could not resolve dependency: peer <x>@"<range>" from <y>`. The bump
is outside a peer's declared range, so nothing installs and no rung runs.

No source change can fix this: it clears when the peer publishes a release that
accepts the new major, or never. Do **not** add an `overrides` entry or install
flags to force it — that silently runs the toolchain in a combination its
authors don't support.

Response: leave the PR open, record it under `docs/STATE.md` → Owner queue with
the blocking peer and its current range, and re-check when that peer ships a
major. Example: `typescript` 7.x is blocked by `typescript-eslint` 8.x
(`peer typescript >=4.8.4 <6.1.0`), still capped as of 8.65.0.

## Shape 2 — lint-rule fallout

A linter major turns rules on and the ladder's `check` rung fails on existing
code (e.g. `@eslint/js` 10 adding `no-useless-assignment` to `recommended`).

The findings are about *our* source, not the bump, so fix them where source
changes belong — a normal `claude/<codename>` branch — not in Dependabot's
branch (pushing there is fought by the next force-push it does). Once the fix
is on `main`, the Dependabot PR goes green on its next rebase.

Reproduce a not-yet-installed rule without taking the bump:

```sh
npx eslint . --rule '{"<rule-name>":"error"}'
```

If the new rules are numerous or behavior-sensitive rather than mechanical,
that's a fork: pin them off explicitly in `eslint.config.js` (as the classic
react-hooks rules are) and queue the cleanup as its own unit.

## Shape 3 — coupled majors

Two bumps that can't land alone — A's new major won't install under B's old
peer cap, and B's new major needs A. Dependabot splits them and **both** PRs go
red forever.

Take them together in one branch, then ask the owner to close the split PRs as
superseded. Precedent: eslint 9→10 + eslint-plugin-react-hooks 5→7 (#206/#207,
superseded 2026-07-18).

## Always

- A dep bump is a **reviewable event**. Confirm the diff touches only
  `package.json` / `package-lock.json`, and re-read the supply-chain rules
  before merging anything that gains an install script.
- Land the fix ladder-green, and say in the commit which rungs ran.
- Anything left unfixable goes to the Owner queue with the reason, not into a
  silent backlog.
