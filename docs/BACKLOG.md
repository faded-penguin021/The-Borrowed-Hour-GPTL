# Execution backlog — audit + hardening (2026-07)

This file is the single source of truth for the audit/hardening effort. Any session
(any model) picks the **topmost `todo` unit**, executes exactly that unit, and stops.
Statuses: `todo` / `done` / `blocked: <one-line reason>`.

## Protocol (every unit, every session)

1. Work on branch `claude/text-game-audit-plan-vfxup6`, starting from a clean tree.
   **One tool call at a time. No subagents, ever. No parallel agents.**
2. Do only the unit's spec below. Definition of done: `npm run ladder` passes
   (typecheck → lint → unit tests → build; ~21s). If you pipe its output
   (e.g. through `tail`), run `set -o pipefail` first and check the exit code —
   a bare pipe reports the *pipe's* exit and can mask a red ladder.
3. Update the unit's status line in this file, commit with the unit's message prefix,
   then `git push -u origin claude/text-game-audit-plan-vfxup6`
   (on network failure retry after 2s/4s/8s/16s).
4. **If green is unreachable**: `git restore . && git clean -fd`, set the unit to
   `blocked: <reason>` here, commit and push that note alone, and stop. The branch
   must never be left red; failures leave a pushed record too.
5. Phase A units also append findings to `docs/audit-2026-07.md`
   (files reviewed, verdicts, fixes). The audit itself is checkpointed.
6. Supply-chain rules in `CLAUDE.md` apply verbatim: `npm ci` only (except the
   explicitly-declared dep-change unit B5), any unplanned `package.json` /
   `package-lock.json` diff is a stop-and-report event.

## Units

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

### B4 — Pin GitHub Actions by SHA — **blocked: needs the commit SHAs behind actions/checkout@v6, setup-node@v6, cache@v4, upload-artifact@v4, configure-pages, upload-pages-artifact, deploy-pages — this session's GitHub scope is repo-only, so it cannot read the actions/* repos. Run from a session/machine with normal GitHub read access (git ls-remote --tags per action) and substitute `uses: owner/action@<sha> # vN`.**
- In `ci.yml` + `pages.yml`, replace each `uses: owner/action@vN` with the commit SHA
  that tag currently points to (comment the tag alongside). Mechanical; PR CI proves it.
- Commit: `ci: pin actions to commit SHAs`

### B5 — Coverage ratchet — **done** (baseline lines 55.7/func 52/branches 76.7 on context+llm+storage; thresholds 53/50/74; npm test now runs coverage, test:fast skips it; vitest family aligned 3.2.6→3.2.7 as part of the declared install)
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
