# Project Rules for Claude Code

## Architecture & State
- `GameContext.jsx` is a God Object. DO NOT add new state or async logic to it. Create dedicated hooks in `src/hooks/` (e.g., `useReveal.js`, `useKeepsake.js`).
- The app uses JSDoc (`// @ts-check`) and a global `src/types.d.ts`. Do not convert files to `.ts`/`.tsx`. Use Zod for runtime validation of LLM outputs.
- Never mutate source state arrays directly; always deep clone or use functional state updates.

## Testing & Verification
- After making structural changes, ALWAYS run `npm run typecheck` to ensure JSDoc contracts are respected.
- After changing `parse.js` or `llm/` logic, run `npm test src/__tests__/parse-recover.test.js`.
- Mock Vite `?raw` imports in Vitest if you touch CSS imports.

## Browser & PWA Edge Cases
- iOS Safari PWA standalone mode breaks `<a download>` if preceded by async `await` calls. Always use a two-tap UI flow or the `ExportFallbackModal` for file generation.
- Web Audio API (`AmbienceEngine`) requires careful cleanup of oscillators and timers to prevent memory leaks.
- Base64 inlining of images can crash mobile Safari. Cap dimensions/quality.

## Security
- API keys are encrypted in `localStorage` via `src/storage/encryption.js`. Never write custom crypto. Always use `getProviderKey()` which handles the passphrase handshake.
