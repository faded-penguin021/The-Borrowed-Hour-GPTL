# STATE — project state & session memory

> **Length guard (hysteresis).** Grow freely to **14 KB**; do no trimming below that
> line. When the guard warns, run ONE deep compression pass to **≤ 9 KB** — never to just
> under the warn line, which re-arms it a session later. The wide band *is* the debounce,
> statelessly (D-005). Fail over **16 KB**. The numbers live in `amh.conf`; keep this
> preamble in lockstep with them.
>
> Compressing means: one Changelog line per completed unit, fold changelog clusters, move
> durable gotchas into `docs/LEDGER.md` (append-only — that is where facts survive), delete
> narrative prose. **Project**, **Current state**, **Owner queue**, **Decided non-items**
> and **Changelog** must always survive; `scripts/ladder.sh` checks their presence and
> non-emptiness, the sizes, duplicate headings, and a **landing check** failing a
> compression that clears the warn but stops inside the band. The content rules above are
> **prose-only**: no guard tells a compressed item from a deleted one.

## Project

The Borrowed Hour — a fully client-side, single-page literary text adventure. No
backend: players bring their own API keys and the browser talks straight to LLM / image
/ TTS providers. Vite 8 + React 19 + TypeScript (strict), Tailwind 4, Vitest (unit) +
Playwright (e2e), ESLint 10, Node 24 in CI. Shipped and deployed to GitHub Pages from
`main` (`.github/workflows/pages.yml`).

## Current state

**Shipped and in maintenance.** The 2026-07 audit + hardening pass (U0–B7, F1–F2) and
the improvement phase (H / T / E / P) are all `done` — `docs/BACKLOG.md` is the record,
git history the detail.

Active multi-unit work: **`docs/plans/amh-principles-in-game.md`** (owner-approved,
branch `claude/text-adventure-amh-crkvd4`) — ports AMH's memory tiering into the *game*,
which today has working memory only. **G1 and G4 done**; G2, G3, G5 open. The plan holds
the detail, including a secondary AMH 4.2.0 → 14.0.0 track not yet in scope.

Standing harness: **AMH v4.2.0**, upgraded 2026-08-09; adopted 2026-07-27 at the
**light** profile (owner-confirmed in session), replacing the hand-rolled v1.8 subset.
`amh.conf` holds every setting; the shipped scripts are never edited locally and
`scripts/MANIFEST.sha256` is checked each run. `docs/LEDGER.md` is permanent memory and
retrieval storage — grep one row, never read a volume whole; its `[cited]` markers are
hand-written and machine-checked, not synced. Plus `scripts/check-supply-chain.mjs`
(the `guard`) and the `model-catalogue-refresh` skill.

Verification = `scripts/ladder.sh` (rungs enumerated in `CLAUDE.md` → Conventions). It no
longer stops at the first failure — one run, one complete report, so read past the first
`FAIL`. Playwright e2e is **not** a rung: separate CI job, locally needs `PW_CHROMIUM`
(the SessionStart adapter exports it). On-device / real-provider behavior is
owner-verified via the Owner queue.

## Owner queue

> **Protected section.** Never delete it or silently drop items during compression
> (items leave only when done / answered / triaged, with the outcome recorded as a
> Changelog line). A session's final chat message restates this queue.

**Pending owner actions:**

1. **PR #221 (`claude/upgrade-amh-newest-0lw7s8`) — fully reviewed, ready to squash-merge;
   your call.**
   The AMH v4.2.0 upgrade is a rule-review diff (`CLAUDE.md`, `amh.conf`, the shipped
   scripts, the ledger preamble). Rule review **was completed** (fresh context,
   strongest tier, owner-requested in session): no blockers, 3 findings, all fixed in
   `1154190` — covering the branch through `08a6cda`. The later
   `LEDGER_ROW_CHAR_CAP` 2000→800 commit (`bcd016d`) was the one later **reviewable**
   commit (the others past `08a6cda` touch only this file — working memory, review-exempt).
   It has since been reviewed too: no blockers, 4 findings, all fixed. Both reviews are
   discharged; what remains is only the merge decision.
   Two things the reviewer could not verify and neither can I: the shipped scripts'
   **upstream provenance** (the clone is deleted, and the manifest was replaced in the
   same commit, so it corroborates nothing on its own — re-clone the tag and diff if
   you want that closed), and D-016's claims about upstream's `amh.conf.example` and
   Upgrading sections.
   `Check:` `git log --oneline origin/main | grep -i 'amh v4.2.0'` — no output means
   still unmerged, so still open.
2. **#213 (`typescript` 6.0.3→7.0.2) is upstream-blocked** — `typescript-eslint` 8.65.0
   still declares `peer typescript >=4.8.4 <6.1.0`, so `npm ci` can't resolve and no rung
   runs. Nothing to fix our side; `overrides` / `--legacy-peer-deps` is explicitly not the
   move. Leave open; re-check when a TS7-capable major ships.
3. **Server-side rails** (owner, 2026-07-25) — branch protection on `main` (PRs required;
   force-push and deletion blocked) and secret-scanning push protection. Agent rails bind
   only agents that load them; the server binds every actor.

**Open questions:** (none. The AMH profile fork was put to the owner in session on
2026-07-27 and answered — `light`. #214 and #215 both merged, closing those items.)

**Incoming findings:** (none)

## Decided non-items

> Don't re-litigate without new evidence. **Protected section** — the structure guard
> hard-fails if this heading goes, so compression cannot re-open a closed decision.

- **AMH runs at the `light` profile** (owner, 2026-07-27). Really light-plus:
  `docs/LEDGER.md` predates the install and was kept, presence outranking profile. Light
  withholds only a separate `docs/RUNBOOK.md` — reaffirming a decision made twice already:
  playbooks stay folded into `CLAUDE.md` until they multiply. Escalating is a re-run with
  `--profile standard`, which only adds files.
- **Shipped AMH scripts are never edited locally.** A local edit turns every future
  upgrade from a copy into a silent merge; the integrity rung reports it. Changes go to one
  of the three extension points — `amh.conf`, `scripts/guards/*.sh`, `scripts/verify.sh`.
- **The install rail keeps its `BORROWED_DEP_CHANGE=1` opt-out** (owner, 2026-07-25),
  "in its narrow and well-defined scope". Narrow is load-bearing — the prefix exempts
  only the segment it prefixes, pinned by `scripts/install-guard.sh --self-test`.
- **`scripts/redact.sh` is the secret scan, not an output filter** (2026-07-27,
  superseding the v1.8 "not adopted" note). Claude Code still has no output-rewriting
  hook, so piping stays manual — but the ladder runs the filter over every text file.
- **No backend of this project's own.** All state in the browser; keys go straight from
  browser to provider (a user's own BYOB proxy is theirs, not ours). See `THREAT_MODEL.md`.
- **Saves & chronicles are local plaintext, not encrypted** (2026-07-16, `48712bd`).
  Deliberate: they hold story state, not secrets. Only API keys are encrypted at rest.
- **`docs/BACKLOG.md` stays the forward backlog** (owner, 2026-07-18) — not archived
  even with every unit `done`. Revisit only if a large `done` tail crowds out live units.
- **`docs/LEDGER.md` is permanent memory** (owner, 2026-07-25). Append-only, code cites
  bare `D-NNN`, markers hand-written and machine-checked both ways (nothing syncs them).
  Durable facts go there, never into STATE, which is compressed away.
- **Fresh-context review is the one subagent exception** (owner, 2026-07-25) — reasoning
  in D-004; protocol in `CLAUDE.md`.
- **A pending review never holds the checkpoint** (owner, 2026-07-25) — D-012.
- **Merge mode is branch-per-change** (owner, 2026-07-25), branches cut from `main`. PR
  #215's blob was a one-time owner exception, not precedent — D-014.
- **eslint-plugin-react-hooks v7's new rules stay off** (owner, 2026-07-18) — ~34
  findings deferred to a dedicated unit; several are effect-timing sensitive and need
  per-site review + tests, not a dep-bump side effect.

## Changelog

One line per shipped change or completed unit (newest first). Pre-harness history lives
in `docs/BACKLOG.md` and git.

- 2026-09-05 — G4 (taken early, out of plan order, because G1 left `LOAD_SAVE` filling
  `EMPTY_LEDGER` — a landmine the moment G2 starts writing rows): save schema v1→v2
  carries the ledger. A v1 save gets an empty one rather than reconstructed rows; a
  damaged one degrades to empty via `StoryLedgerSchema`. Autosave deps and both save
  call sites wired; version assertions now read `CURRENT_SAVE_VERSION` instead of a
  literal, so the constant and its tests cannot drift.
- 2026-09-05 — G1: the `StoryLedger` tier — permanent memory for the story, append-only
  by construction (`APPEND_LEDGER_ROWS` is the only action; no edit or delete exists).
  Dedupe, a truncating row cap, and rollover that folds the oldest batch into a frozen
  chronicle rather than deleting it. Undo truncates by turn — the *player* unmaking a
  turn, never the GM revising a row. Nothing writes rows yet; that is G2.
- 2026-09-05 — Approve and record `docs/plans/amh-principles-in-game.md`: port AMH's
  memory tiering into the game. Plan + pointer only.
- 2026-08-30 — Refresh model catalogues (LLM only): OpenRouter dropped the free variant
  of `openai/gpt-oss-20b` (`:free` 404s per `check:models --all`); moved the still-live
  paid id to that provider's `paid` tier rather than dropping it (not a default anywhere).
  Wiki synced. Image/TTS catalogues checked against provider docs (Groq, Cerebras, ERNIE,
  DeepSeek, Kimi, Qwen, Mistral, Gemini, OpenAI, Replicate flux family, OpenAI TTS,
  ElevenLabs, Azure, Google) — all current, no changes needed. PR #227.
- 2026-08-19 — Refresh model catalogues (LLM only): `gemini-3.6-flash` →
  `gemini-3.7-flash` (GA 2026-08-13), `gemini-3.1-flash-lite` → `gemini-3.5-flash-lite`
  (3.1 deprecated per its own ai.google.dev page); wiki synced. Image/TTS catalogues
  checked against provider docs — no changes needed. PR #224.
- 2026-08-09 — Lower `LEDGER_ROW_CHAR_CAP` 2000 → **800** (owner). Binds new rows only —
   the rung exempts any row ID present at HEAD, and only runs at all when the ledger has
   uncommitted changes — so nothing was rewritten and no existing row fails. Deliberately
   below the shipped default *and* below this ledger's own median: 7 of 16 prior rows exceed
   it. Measure with
   `awk '/^- D[A-Z]*-[0-9]+/{if(id)printf "%s\t%d\n",id,n; id=$2; n=0} id{n+=length($0)+1}
   END{if(id)printf "%s\t%d\n",id,n}' docs/LEDGER.md | sort -k2 -nr` — reads **one byte high**
   per row versus the guard, which strips the trailing blank line, so treat a result of exactly
   801 as a pass and re-check with the ladder. Preamble kept in
   lockstep, plus a warning that `LEDGER_LINE_CAP` (800 *lines*, whole file) and
   `LEDGER_ROW_CHAR_CAP` (800 *bytes*, one row) now share digits by coincidence and must
   never be reconciled to each other. Cap proven to fire on an 830-byte row before landing.
- 2026-08-09 — Upgrade **AMH v2.1.0 → v4.2.0** (five releases; two MAJORs, both largely
  inert here). Shipped scripts + manifest copied wholesale. `amh.conf` gained
  `REQUIRED_TOOLS`, `ADAPTER_FILES` and `LEDGER_ROW_CHAR_CAP` — the last one enforcing
  whether or not it is set (D-016). Ledger preamble took the seed corrections:
  retrieval storage, rollover as an unbounded odometer, the volume chain,
  `[cited]` machine-*checked* not machine-managed — a wrong claim `CLAUDE.md` and this
  file had both inherited. `CLAUDE.md` took 3.0.0's hookless-rail rule and the pointer to
  the command guard's "does NOT catch" block. 3.0.0's archive-tier rule change is inert:
  no `docs/history/`, no `docs/plans/`, so completed plans are still deleted. Two queue
  items closed by testing rather than restatement: the v2.1.0 review-owed item (merged as
  #216) and the segment-4b branch (no longer on `origin`). Rule review completed on this
  branch: no blockers, 3 findings, all fixed — the worst being a new bullet inserted into
  the middle of an existing one, orphaning a sentence so that "the same filter" resolved
  to the hooks rather than to `redact.sh` and inverted a secret-hygiene claim.
- 2026-08-05 — Refresh model catalogues (LLM only): `claude-opus-4-8` →
  `claude-opus-5`, dropped `claude-sonnet-4-6` (redundant with `claude-sonnet-5`)
  and Groq's `qwen/qwen3-32b` (provider-deprecated 2026-07-17); wiki synced. PR #219.
- 2026-07-27 — Instantiate **AMH v2.1.0** (light), replacing the hand-rolled v1.8 subset.
  Shipped scripts + `MANIFEST.sha256` now come from the harness; everything repo-specific
  moved to the three extension points — `amh.conf`, `scripts/verify.sh`, and
  `scripts/guards/` (`docs-citations.sh` keeps the prose half of the citation check the
  shipped code-only scan drops; `install-rail.sh`). The registry-install rail the shipped
  command guard does not carry became `scripts/install-guard.sh`, a second `PreToolUse`
  hook with the opt-out intact (D-015). Guards gained: secret-shape scan, poison tokens,
  author identity, shipped-script integrity, rule-file advisory. Bootstrap is now
  `scripts/session-start.sh` + `scripts/bootstrap.sh`, `.claude/` reduced to wiring —
  which completes and retires `docs/plans/amh-v1.8-adoption.md`.
- 2026-07-25 — AMH v1.8 adopted across four passes plus the owner's five fork answers,
  and superseded two days later by v2.1.0 above. Lessons kept: D-008 → D-014.
- 2026-07-25 — Shipped alongside it: the `@eslint/js` 10 lint fallout cleared at the
  source (four `no-useless-assignment` errors reddening #214) with
  `docs/dependabot-triage.md` added, and the Gemini fix omitting `temperature` for 3.5+
  models, which that family deprecated (ignored today, HTTP 400 later).
- 2026-07-22 — Refresh model catalogues (LLM only): `gemini-3.6-flash`, `kimi-k3`,
  OpenRouter `gpt-oss-20b:free` + `gpt-5.6-luna`; wiki synced.
- 2026-07-18 — Take the coupled Dependabot eslint majors together (eslint 9→10 +
  react-hooks 5→7), pinning the classic react-hooks rules so v7's new ones don't newly
  gate; then the first maintenance harness — STATE, the ladder as single CI-shared
  entrypoint, session discipline, deny rails — and the secret-hygiene pass on top.
