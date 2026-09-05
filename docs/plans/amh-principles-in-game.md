# AMH principles applied to the game

## Context

The repo runs AMH as *process*. The game it ships has the same shape as an agent session —
a long-running loop, a context window that overflows, a state blob that gets rewritten —
and has solved almost none of it the way AMH does. This plan ports the principles inward.

**The finding that drives everything: the game has working memory only.**

`src/context/gameLoop.ts:395-425` prunes `apiHistory` hard — 20 messages at a time above an
80 000-char cap (60 000 on Groq), keeping `HEAD_KEEP=2` and a 4-message tail. Pruned turns
are gone; `prunedPrefixLength` only grows. The single carrier across that boundary is
`GameState`, and `GameState` is **rewritten wholesale by the GM every turn** —
`storyReducer.ts:202-234` replaces it, every field, including `summary`, `npcs`, `clues`
and `hidden_state`.

So a fact established at turn 3 reaches turn 40 only if the GM re-copies it forward through
~37 full rewrites, with the source turns deleted from history. That is precisely the failure
`CLAUDE.md` warns about for sessions — *"durable facts go [to the ledger], not into
`docs/STATE.md` (working memory) — STATE is compressed every few sessions and will lose
them"* — except the game compresses every turn. **There is no permanent-memory tier.**

What the game already gets right, and which this plan reuses rather than rebuilds:

- **P1, ground-truth hierarchy, enforced structurally.** `PlayerLedger` deliberately has no
  `hidden_state` field, so `toPlayerLedger` makes it type-level impossible for GM-only state
  to reach the Ledger UI (`src/types.ts:76-97`). Exactly AMH's shipped-vs-yours barrier,
  in the type system.
- **P7, bounded recovery.** The retry prompts and `Recovery` state
  (`storyReducer.ts:5-19`, `gameLoop.ts:187,463`).
- **P17, secrets.** Encrypted at rest, no telemetry path.
- A save-migration rail already exists — `CURRENT_SAVE_VERSION`, `migrateSave`
  (`src/saves/migrate.ts`) — so adding a tier is a supported v2 bump, not new machinery.

## The three things you named, mapped

| Your words | AMH mechanism | Where it lands in the game |
|---|---|---|
| Salient reminders | Session-start banner; "read `docs/STATE.md` first" | The story ledger injected verbatim into **every** turn's prompt, above the mutable state block |
| Hooks | `PreToolUse` rails | A post-parse checkpoint in the turn pipeline, before parsed state is committed to the reducer |
| Machine-enforceable rules | Ladder guards over real artifacts | Pure `checkContinuity(prev, next, ledger)` over the **state diff** — an artifact every turn produces anyway — unit-tested, so `scripts/ladder.sh` covers it |

## The design

### A permanent-memory tier: `StoryLedger`

Append-only, mirroring `docs/LEDGER.md`. Rows `{ id: "L-001", turn, kind, text }`, where
`kind` is `established | ruled_out` — the second is **P10, negative memory**: what the story
has closed off, so a later turn cannot quietly re-open it.

The append-only property is **structural, not prose**: the only reducer action is
`APPEND_LEDGER_ROWS`, which concatenates. No action edits or deletes a row. The GM reaches
it through a new `ledger_append?: string[]` field on the tool schema — it can propose rows,
never revise them. That barrier is the same trick `PlayerLedger` already plays, and it is
what makes "append-only" true rather than requested.

**Bounded, because P2 bounds every tier an agent must read.** Row char cap plus a total row
cap, both as named constants beside `EMPTY_STATE` in `src/data/constants.ts` (thresholds in
one declared place, as `amh.conf` does). On overflow: AMH **rolls over, never deletes** —
the oldest volume folds once into a frozen `chronicle` string that is never rewritten
again. Deleting rows would rebuild the exact defect this tier exists to fix.

### Machine-enforceable rules

A pure function, no I/O, fully unit-testable — which is what puts it under the ladder:

```
checkContinuity(prev: GameState, next: GameState, ledger: StoryLedger, narration: string): Finding[]
```

Candidate rules, each falsifiable against artifacts the turn already produces:

1. **Hidden-state leak** — a `next.hidden_state` fragment surfacing in `narration`. The
   strongest of the set and genuinely uncovered today: the type barrier stops `hidden_state`
   reaching the Ledger *UI*, but nothing stops the GM narrating it, and the prompt's own
   `[GM-PRIVATE]` warning (`src/llm/prompt.ts:48`) is a request, not a rail.
2. **Silent NPC deletion** — a name in `prev.npcs` absent from `next.npcs`. People do not
   vanish; they gain a note. (Inventory loss is legitimate — items get used — so it is
   *not* a rule.)
3. **Ruled-out contradiction** — `next` reintroduces something a `ruled_out` row closed.
4. **Ending integrity** — `ended` set with no `ending`, or an `ending` outside
   `VALID_ENDINGS` (`src/data/constants.ts:99`).

Reuse, don't duplicate: `isStateEmpty` already guards the empty-state clobber at
`gameLoop.ts:128`, and Zod already covers schema shape in `src/llm/parse.ts` — these rules
sit strictly on top of both.

Findings are **advisory to the player**, never an auto-rewrite. One level of meta: the guard
reports, the player arbitrates (P9 — the player is the owner, and the Ledger UI is the
queue).

### What this plan explicitly refuses to build

**P3: never build machinery on a self-report.** The obvious wrong turn here is a
`consistency_check: true` field on the tool schema, or asking the GM "did you contradict
yourself?" and branching on the answer. An LLM emits those without doing the work — the same
Goodhart defect as an agent ticking its own review box. Every rule above reads the *diff*;
none reads a claim.

And the honest limit, stated because overstating coverage is what stops the next reader
checking by hand: **none of these detect semantic contradiction.** Prose that contradicts
prose needs meaning, which is what AMH refuses to gate on. These are tripwires for
structural drift, not proof of a coherent story.

## Units

Each ends: `scripts/ladder.sh` green → `docs/STATE.md` Changelog line → commit → push. None
of these touch `RULE_FILES`, so **no rule review** — but G2 and G3 land in streaming, parse
and abort glue, which is exactly what unit tests cannot see, so both take a **glue review**
(fresh context, hostile reviewer, the sanctioned subagent).

- **G1 — the tier.** `StoryLedger` types in `src/types.ts`, `APPEND_LEDGER_ROWS` in
  `storyReducer.ts`, caps in `src/data/constants.ts`, rollover-to-`chronicle`. Vitest vectors
  for append-only-ness and rollover. No prompt change, no LLM contact — pure state plumbing.
- **G2 — the salient reminder.** `ledger_append` on the GM tool across
  `src/llm/schemas.ts`, `responseSchemas.ts`, `definitions.ts`; ledger block emitted by
  `formatStateForPrompt` (`src/llm/prompt.ts:19`) above the mutable state; prompt wording in
  `src/prompts/`, never inlined elsewhere. Touches parse + streaming → **glue review**;
  touches game flow → **run Playwright**.
- **G3 — the guards and the hook.** `checkContinuity` + vectors; wired at the post-parse
  checkpoint in `gameLoop.ts` before state is committed. Prove each rule *fires*, not just
  passes (D-007). **Glue review** — the abort path is where a stale finding could land after
  a cancelled turn.
- **G4 — persistence.** Save schema v1→v2 through the existing `migrateSave`; ledger into
  export/chronicle surfaces. Golden storage fixtures are ground truth here.
- **G5 — the surface.** Ledger + findings in the existing Ledger UI. Player-facing → Playwright.
- **G6 — deferred, your call.** P12's fresh-context reviewer as a second cheap-model pass
  that sees the ledger and the narration but never the GM scratchpad or `hidden_state`.
  Costs an extra call on a bring-your-own-key app, so it would ship default-off. Listed, not
  planned — it earns a unit only if G3's structural rules prove insufficient in play.

## Secondary track — the harness itself

Separate from the above and droppable; recorded because the research is done and two
findings are live:

1. **Upstream AMH is at v14.0.0; this repo pins 4.2.0** — twenty-one releases. Shipped there
   and absent here: the `Task`-matcher subagent rail (`command-guard.sh --pre-task`, 9.1.0),
   `--pre-push` (9.1.0), fail-*closed* command parsing (8.0.0), six private-key `Read()`
   denies (6.0.0), the forge-mutation rail (10.5.0), and the `.gitattributes` seed (10.4.0)
   without which a CRLF checkout makes the ladder unrunnable on macOS/Linux. Upgrade path is
   upstream's own: clone the **tag**, copy the five scripts + manifest, walk the CHANGELOG
   oldest-first. Two config keys are missing: `LEDGER_ROW_SENTENCE_CAP`,
   `STATE_COMPRESS_TO_SENTENCES`.
2. **Owner queue item 1 is stale** — `origin/main`'s `amh.conf` already reads 4.2.0 and this
   branch is identical to `origin/main`, so PR #221 merged; the item's own `Check:` greps
   commit subjects and reports "still open". This is 14.0.0's *"working memory is
   tree-relative"* defect, live. Fix: state the merge as an observation scoped to when it was
   seen, and point the check at the tree. The stale
   `origin/claude/upgrade-amh-newest-0lw7s8` branch is an owner deletion.

## Verification

- `scripts/ladder.sh` directly (never piped) at the end of every unit; guards no longer stop
  at the first `FAIL`, so read past it. `--guards-only` for docs-only work.
- New rules ship with vectors that **fail without the rule** — D-007: a guard is proven to
  fire, not assumed to pass.
- `npm run test:e2e` on G2 and G5 (`PW_CHROMIUM` is exported by the SessionStart adapter);
  e2e is not a ladder rung, so it is run by hand and named in the commit body.
- Long-session behaviour — whether the ledger actually holds continuity past a prune at turn
  40+ — needs a real provider key and is **owner-verified through the Owner queue**. No rung
  reaches it, and no commit body may imply otherwise.

## Owner queue (restated)

1. PR #221 — **merged**; item 1 is stale and G-track item 2 above corrects it.
2. #213 `typescript` 6.0.3→7.0.2 — upstream-blocked by `typescript-eslint`'s peer range.
3. Server-side rails — branch protection and secret-scanning push protection, still open.
4. New: the AMH 4.2.0→14.0.0 gap above, and whether the secondary track is in scope at all.
