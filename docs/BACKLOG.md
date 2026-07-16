# Execution backlog

This file is the single source of truth for backlogged engineering work. Any session
(any model) picks the **topmost `todo` unit**, executes exactly that unit, and stops.
Statuses: `todo` / `done` / `blocked: <one-line reason>`.

## Protocol (every unit, every session)

1. Work each unit on a fresh branch cut from `main`, starting from a clean tree.
   **One tool call at a time. No subagents, ever. No parallel agents.**
2. Do only the unit's spec below. Definition of done: `npm run ladder` passes
   (typecheck → lint → unit tests → build; ~21s). If you pipe its output
   (e.g. through `tail`), run `set -o pipefail` first and check the exit code —
   a bare pipe reports the *pipe's* exit and can mask a red ladder.
3. Update the unit's status line in this file, commit with the unit's message prefix,
   then `git push -u origin <branch>` (on network failure retry after 2s/4s/8s/16s).
4. **If green is unreachable**: `git restore . && git clean -fd`, set the unit to
   `blocked: <reason>` here, commit and push that note alone, and stop. The branch
   must never be left red; failures leave a pushed record too.
5. Phase A units also append findings to `docs/audit-2026-07.md`
   (files reviewed, verdicts, fixes). The audit itself is checkpointed.
6. Supply-chain rules in `CLAUDE.md` apply verbatim: `npm ci` only (except the
   explicitly-declared dep-change unit B5), any unplanned `package.json` /
   `package-lock.json` diff is a stop-and-report event.

## Units — audit + hardening (2026-07) — **complete**

**Every unit below (U0–B7) and the follow-ups (F1–F2) is `done`.** They stay here as
the record; the units originally ran on branch `claude/text-game-audit-plan-vfxup6`
(since merged). Active work starts at the improvement phase further down.

### U0 — Bootstrap the checkpoint rail — **done** (this commit)
Ladder script, this backlog, audit scaffold, CONTRIBUTING/CLAUDE.md pointers, draft PR.

### U1 — Make e2e runnable in agent sessions — **done** (verified: 7/7 smoke + 5/5 prod with `PW_CHROMIUM=/opt/pw-browsers/chromium`)
- In `playwright.config.ts` and `playwright.prod.config.ts`, honor an env override:
  `launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}`
  inside the chromium project's `use`. CI is unaffected (env unset there).
- Acceptance: in a remote agent container,
  `PW_CHROMIUM=$(find /opt/pw-browsers -maxdepth 3 -name chrome -o -maxdepth 3 -name headless_shell | head -1) npm run test:e2e`
  passes 6/6; `npm run ladder` green.
- Fallback: if the container Chromium is genuinely incompatible with the pinned
  Playwright, mark `blocked` — CI remains the e2e authority.
- Commit: `test(e2e): allow PW_CHROMIUM executable override for agent sessions`

### Phase A — judgment-heavy audit (strongest available model; in order)

Each unit: deep-read the listed files end to end → fix real defects found → add a
regression test for **every** finding (tests are the durable artifact even when the
verdict is clean) → append an entry to `docs/audit-2026-07.md` → ladder → commit → push.

### A1 — LLM output trust boundary — **done** (fixed-2: size clamps, array unwrap; see audit log)
- Files: `src/llm/parse.ts`, `src/llm/stream.ts`, `src/llm/zodConfig.ts` (+ its test),
  existing coverage in `src/__tests__/parse-recover.test.ts`.
- Questions: malformed / truncated / adversarial model output; partial-JSON recovery;
  schema-violation handling; what reaches the reducer unvalidated.
- Commit prefix: `fix(llm)` / `test(llm)` / `docs(audit)`

### A2 — Turn pipeline correctness — **done** (fixed-3: run latch, stale-abort rollback, loadSave rehydration; see audit log)
- Files: `src/context/gameLoop.ts`, `src/context/storyReducer.ts`,
  `src/context/GameContext.tsx`; coverage in `gameLoop-unit.test.ts`,
  `gameLoop.test.tsx`, `storyReducer.test.ts`.
- Questions: double-submit; abort mid-stream; error mid-reduce; autosave timing;
  retry semantics; stale-closure/race hazards across the async pipeline.
- Commit prefix: `fix(context)` / `test(context)` / `docs(audit)`

### A3 — Crypto & key custody — **done** (fixed-1: session cap re-arms per unlock; all THREAT_MODEL claims verified; see audit log)
- Files: `src/storage/*`, `src/security/autoLock.ts`, `src/passphrase.ts`;
  coverage in `src/storage/encryption.test.ts`, `src/__tests__/migrate.test.ts`.
- Verify every THREAT_MODEL.md claim against code: PBKDF2-SHA-256 310k iterations;
  non-extractable AES-GCM key; fresh random IV per encryption; v1→v2 unlock-time
  migration sweep; salt-missing-but-v2-present fails loud; no key/passphrase in
  logs, errors, or exports. Fix whichever side (code or doc) has drifted.
- Commit prefix: `fix(storage)` / `test(storage)` / `docs(audit)`

### A4 — Untrusted persistence & export — **done** (fixed-1: save-load normalization + guarded load; exports verified clean; see audit log)
- Files: `src/hooks/useSaves.ts`, `src/saves/*`, `src/export/keepsake.ts`,
  `src/storage/imageStore*`; coverage in `imageStore.test.ts`, `compression.test.ts`.
- Questions: an imported save is attacker-controlled JSON headed for the reducer —
  is it validated at the boundary (shape, sizes, types)? Do exports (keepsake, save
  files) ever embed keys or ciphertext they shouldn't? Blob/quota failure paths.
- Commit prefix: `fix(saves)` / `test(saves)` / `docs(audit)`

### A5 — CSP / doc conformance sweep — **done** (fixed-1: Google+Azure TTS origins were missing from connect-src; manifest at src/security/origins.ts; see audit log)
- Compare every network origin used in `src/llm/providers.ts`, `src/llm/imaging.ts`,
  `src/tts/*`, `src/llm/client.ts` against the `connect-src` allowlist in
  `index.html`. Produce a canonical origin manifest (e.g. exported const or JSON
  consumed by both code and B1's test). Fix drift on whichever side is wrong; correct
  any stale claims in `README.md` / `docs/wiki.md`.
- Commit prefix: `fix(csp)` / `docs(audit)`

### Phase B — deterministic hardening (safe for lesser models; in order)

### B1 — CSP drift test — **done** (folded into A5: src/security/origins.test.ts, verified red-on-drift)
- New unit test: parse `index.html`'s CSP `<meta>` `connect-src`, compare with the
  A5 origin manifest; fail on drift in either direction (extra or missing origin).
  If A5 never ran: build the manifest by grepping fetch/URL origins under `src/llm`,
  `src/tts` first, and check it in as a fixture.
- Acceptance: test fails when a fake origin is added to either side (try it, revert),
  passes on clean tree; ladder green.
- Commit: `test(csp): lock connect-src to the provider origin manifest`

### B2 — Supply-chain guard as code — **done** (all 5 tripwires verified red then restored; wired into ladder + CI)
- New `scripts/check-supply-chain.mjs`, zero-dep Node, exits non-zero on:
  lockfile `hasInstallScript` outside allowlist {`esbuild`, `fsevents`}; presence of
  package families `axios`, `@ctrl/tinycolor`, `@duckdb/node-*`,
  `@nativescript-community/*` in the lockfile; a tracked or working-tree `.npmrc`;
  rogue AI-config files (`.cursorrules`, `.windsurfrules`, `.aider*`, `.continue/`,
  `.github/copilot-instructions.md`); any `binding.gyp` under `node_modules/` (skip
  silently when `node_modules` absent).
- Wire: `"guard": "node scripts/check-supply-chain.mjs"`, prepend to `ladder`,
  add as a CI step after `npm ci` in `.github/workflows/ci.yml`.
- Acceptance: guard passes on clean tree; flip each rule locally to prove it fails
  (e.g. temp `.npmrc`), revert; ladder green.
- Commit: `ci(security): enforce supply-chain tripwires as a guard script`

### B3 — Sink lint rules — **done** (no-eval, no-new-func, restricted properties + dangerouslySetInnerHTML selector; zero existing violations; verified red on probe)
- In `eslint.config.js` add `no-restricted-properties` / `no-restricted-syntax`
  banning: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`,
  `eval`, `new Function`, `document.write`. Message should point at
  `src/security/trustedTypes.ts`. Only that file may carry targeted inline disables
  (it wraps the two sanctioned sinks).
- Acceptance: `npm run lint` green; adding a stray `el.innerHTML = x` anywhere fails
  lint (try it, revert); ladder green.
- Commit: `chore(lint): ban script-injection sinks at commit time`

### B4 — Pin GitHub Actions by SHA — **done** (all 11 uses: lines across ci.yml + pages.yml pinned to full commit SHAs with `# vN` comments; SHAs supplied by the user via git ls-remote 2026-07-10; the dependabot actions group maintains the pins from here; note: the three pages-only pins first execute on the next main deploy — pages.yml has workflow_dispatch for a manual test)
### B5 — Coverage ratchet — **done** (re-baselined 2026-07-10 under vitest 4's AST-aware remapping: lines 44.5/func 45/branches 30.1 → thresholds 42/43/28/40; original vitest-3 baseline was 55.7/52/76.7 → 53/50/74; npm test runs coverage, test:fast skips it)
- Add `@vitest/coverage-v8` as devDependency (lockfile diff expected and declared).
- Enable v8 coverage in `vite.config.js` test block scoped to `src/context`,
  `src/llm`, `src/storage`; measure, then pin `thresholds` at measured−2%.
- Acceptance: `npm test` green with thresholds; lockfile diff contains only the new
  package family; ladder green.
- Commit: `test: add scoped coverage thresholds for context/llm/storage`

### B6 — Storage-format golden fixtures — **done** (src/storage/encryption-golden.test.ts: committed v1+v2 blobs, decrypt + migration + wrong-passphrase; a failure means add-a-migration, never regenerate)
- Generate one `enc:v1:` and one `enc:v2:` blob with a known passphrase (use the
  code's own encrypt path in a script or test-time), commit as fixtures, and test
  that unlock + v1→v2 migration reproduce the plaintext (extends `migrate.test.ts` /
  `encryption.test.ts`). Freezes back-compat against future refactors.
- Commit: `test(storage): golden fixtures freeze enc:v1/v2 compatibility`

### B7 — Dependabot, weekly, grouped — **done** (.github/dependabot.yml: npm minor+patch grouped weekly, majors solo, actions grouped; guard runs on every PR)
- Add `.github/dependabot.yml`: npm ecosystem, weekly, grouped minor+patch updates,
  separate group for GitHub Actions. Its PRs are explicit dep-change events per
  CLAUDE.md rule 2; B2's guard runs on them.
- Commit: `ci: add grouped weekly dependabot config`

## Follow-ups (post-audit)

Same protocol as above, except the audit branch has merged — work each unit on
a fresh branch cut from `main`.

### F1 — Provider request-shaping fixes — **done** (2026-07-12: Anthropic CORS opt-in, health-check params, temperature-rejection memo, keyless BYOB, Google TTS key header; see audit log F1)

### F2 — Route checkProviderHealth through the BYOB proxy — **done** (2026-07-12: shared applyProxyToRequest helper; TEST pings keyless through the proxy; proxied test case added)
- `checkProviderHealth` (src/llm/providers.ts) builds and fetches directly, so
  with a proxy configured the Settings TEST button hits the provider from the
  browser (CORS + stripped-key failures) even though in-game calls work.
  Mirror client.ts: apply the proxy rewrite + key-header strip, and resolve
  the key with `allowMissing` when a proxy is set. Extend
  `src/__tests__/providers-request.test.ts` with a proxied TEST case.
- Commit: `fix(llm): health-check honors the BYOB proxy`

## Improvement phase (2026-07, post-audit)

Planned 2026-07-16 from a full inventory of the repo (test-coverage map, harness
config, docs, e2e surface). Same protocol as above. Phases are in priority order
(H → T → E → P); work units top to bottom.

### Phase H — agent-harness enablement

### H1 — `.claude/settings.json` + SessionStart hook — **todo**
- Add `.claude/settings.json` with:
  - a SessionStart hook that runs `npm ci` and exports a `PW_CHROMIUM` discovery
    (see U1's acceptance command) so remote agent sessions are test- and e2e-ready
    at session start;
  - a permissions allowlist for the repo's read-only staples
    (`npm run check|test|test:fast|guard|ladder`, `git status|log|diff`).
- Same unit amends `CLAUDE.md` "Integrity of this file": `.claude/` is
  user-sanctioned as of this unit; any *later* unexplained change to it is a
  stop-and-report event like the rest of the tripwire list.
- Acceptance: a fresh remote session reaches `npm run ladder` green with no manual
  setup; `npm run guard` still passes (guard must not flag `.claude/`).
- Commit: `chore(harness): SessionStart hook + permission allowlist for agent sessions`

### H2 — model-catalogue-refresh repo skill — **todo**
- Encode the procedure of `docs/model-catalogue-maintenance.md` as
  `.claude/skills/model-catalogue-refresh/SKILL.md` so the weekly scheduled session
  invokes it deterministically. The doc stays as rationale/reference; the skill
  carries the executable steps: `npm run check:models`; edit only the three
  catalogue files (`src/llm/providers.ts`, `src/llm/imaging.ts`,
  `src/tts/catalogue.ts`) plus `docs/wiki.md` model references; refresh
  `// checked:` stamps; curate-not-dump rules; ladder; PR-never-automerge.
- Acceptance: skill steps match the doc (drift in either is a defect); ladder green.
- Commit: `chore(harness): encode model-catalogue refresh as a repo skill`

### Phase T — test depth on the riskiest untested code

### T1 — Keepsake export lockdown — **todo**
- `src/export/keepsake.ts` escapes HTML (`escapeHtml`) — freeze it. New unit tests:
  narration/action/title text containing `<script>`, attribute-breakout quotes, and
  entity edge cases must never reach the exported HTML unescaped. Cover every
  interpolation site in the template (grep the file for `${` and account for each).
- Commit: `test(export): lock keepsake HTML escaping at every interpolation site`

### T2 — useSaves + compression failure paths — **todo**
- Files: `src/hooks/useSaves.ts`, `src/saves/compression.ts`. Tests for
  quota-exceeded rollback, corrupted/truncated blob → readable error (extend the
  round-trip-only `compression.test.ts`), and save-version handling. Reuse the
  patterns in `imageStore.test.ts` (quota rollback) and `migrate.test.ts`
  (damaged records).
- Commit: `test(saves): cover quota, corruption, and version failure paths`

### T3 — TTS adapter request-shaping tests — **todo**
- Cover the untested adapters in `src/tts/adapters/` (azure, elevenlabs, openai,
  browser) mirroring `tts-google.test.ts` / `tts-voxtral.test.ts`: key placement
  (headers, never URLs unless the API forces it — see A3 note), endpoint origin
  (must be present in `src/security/origins.ts`), payload shape.
- Commit: `test(tts): request-shaping coverage for azure/elevenlabs/openai/browser`

### T4 — artDirector orchestration + prompt serialization tests — **todo**
- Files: `src/llm/artDirector.ts` (orchestration; only helpers/caption are covered
  today) and `src/llm/prompt.ts` (state serialization / prompt formatting).
- Commit: `test(llm): cover artDirector orchestration and prompt serialization`

### T5 — Coverage ratchet expansion — **todo** (only after T1–T4)
- Add `src/export`, `src/saves`, `src/hooks`, `src/tts` to the coverage scope in
  `vite.config.js`; measure; re-pin thresholds at measured−2% (same rule as B5).
- Commit: `test: expand coverage ratchet to export/saves/hooks/tts`

### Phase E — e2e depth (reuse the mocked-LLM pattern in `e2e/smoke.spec.ts`)

### E1 — Undo + Wild mode e2e — **todo**
- Start a Wild premise, advance a turn, undo; assert entries and visible state roll
  back cleanly.
- Commit: `test(e2e): wild-mode start and undo round-trip`

### E2 — BYOB proxy settings e2e — **todo**
- Configure a proxy URL in Settings against a mock endpoint; assert the TEST button
  and an in-game turn both route through it (regression net over F1/F2).
- Commit: `test(e2e): BYOB proxy carries TEST and turn traffic`

### Phase P — product improvement (evidence-backed)

### P1 — check-models covers image + TTS catalogues — **todo**
- Extend `scripts/check-models.mjs` beyond the LLM/OpenRouter cross-check: verify
  image and TTS catalogue ids against the provider endpoints the app itself uses,
  closing the staleness-only gap documented in `docs/model-catalogue-maintenance.md`
  (the Pollinations single-model collapse, 8343b60, is the motivating failure).
  Update that doc to match.
- Commit: `feat(scripts): health-check image and TTS catalogues in check:models`

### P2 — Playtest-driven UX punch list — **todo** (discovery unit; run last)
- Run the app end-to-end against a scripted mock provider (title → turns → ending →
  reveal → meta → keepsake export) and record concrete friction items as new `todo`
  units appended to this file. The output is backlog units, not code.
- Commit: `docs(backlog): UX punch list from scripted playtest`
