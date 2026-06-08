# Threat model — The Borrowed Hour

The Borrowed Hour is a fully client-side, bring-your-own-API-key single-page app
with **no backend**. Your provider API keys live only in this browser; the app
talks directly to each provider's own API and to no server of ours. This document
states plainly what the app's security mechanisms do and do not protect against,
so the in-app copy and this file agree.

## Assumptions

- The browser is modern and the same-origin code it runs (this app's bundle) is
  trusted and unmodified. We assume WebCrypto (`crypto.subtle`) is available.
- The user supplies their own API keys and accepts the cost/abuse risk of those
  keys with their chosen providers.
- The opt-in Puter TTS provider loads third-party script from `js.puter.com`; a
  user who never selects it never loads it.

## Explicit non-goal

There is **no defense once arbitrary script runs on the page while keys are
unlocked.** Encryption-at-rest protects a *passive read* of browser storage; it
does not, and cannot, protect a secret from code executing in the same origin
that holds the live session key. The real anti-XSS defenses are the strict CSP,
the absence of `innerHTML`/`dangerouslySetInnerHTML`/`eval`, React's text
escaping, and the bring-your-own-key model — not the encryption.

## Per-surface table

| Surface | Threat | Defended? | Mechanism |
| --- | --- | --- | --- |
| Passphrase / session key | Exfiltration of the secret from page memory | **Partial** | The raw passphrase is consumed at unlock and dropped; only a **non-extractable** AES-GCM `CryptoKey` is retained. Its raw bytes cannot be exported even by in-page script — but such script can still *use* it to decrypt while unlocked. |
| Encryption at rest | Passive read of `localStorage` (device/extension/backup snooping the stored value) | **Defended** | Stored keys are AES-GCM ciphertext; key derived via PBKDF2-SHA-256 (310k iterations) from the passphrase + a per-install KDF salt. A casual peek finds only ciphertext. |
| KDF salt | Salt disclosure | **N/A (not secret)** | The salt is public by design (it only de-duplicates derived keys across installs and frustrates precomputed tables). It is stored in plaintext `localStorage`; useless without the passphrase. |
| `localStorage` / IndexedDB | Other same-origin code, or device theft of an *unlocked* session | **Partial** | Mitigated by auto-lock: the session key is dropped when the tab is backgrounded past a short grace, plus a long absolute session cap. A locked session exposes only ciphertext. |
| XSS / injected script | Arbitrary JS running in the origin | **Defended (prevention), not (post-compromise)** | Strict `script-src` with no `'unsafe-inline'`; no `innerHTML`/`eval`; React escaping; `style-src-elem` blocks injected `<style>`. `require-trusted-types-for 'script'` is **enforced**: the browser rejects a raw string at any script sink. The app's only programmatic sink — the lazy `<script>` for the opt-in Puter TTS SDK — routes through the `puter-loader` Trusted Types policy (`src/security/trustedTypes.ts`), the one name the `trusted-types` allowlist permits; the dev server strips the directive (Vite tooling touches sinks the shipped build never does). No report endpoint is required (enforcement doesn't depend on reporting) or possible (no backend). Verified by `e2e-prod/trusted-types.spec.ts` against the production build (`npm run test:e2e:prod`). If script does run while unlocked, it can use the session key — see the non-goal above. |
| CSP scope | Loading scripts/styles/connections from unexpected origins | **Defended** | `default-src 'self'`; an explicit `connect-src` allowlist of provider endpoints (incl. `http://localhost:*` / `127.0.0.1:*` for local LLMs); `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'none'`. `upgrade-insecure-requests` is intentionally omitted so local-LLM `http://` endpoints keep working. |
| Dev-server relaxation | A strict prod policy being silently weakened | **Scoped to dev** | `vite.config.js` re-adds `'unsafe-inline'` to `script-src` (Fast Refresh preamble) and `style-src-elem` (HMR `<style>`) **only** when serving in dev. The built `dist/index.html` keeps the strict policy. |
| Third-party `js.puter.com` | Compromise/abuse of an external script | **Accepted, documented** | Loaded lazily and only when the user opts into Puter TTS. A documented trust surface; users who don't use it never load it. |
| Network egress | Keys/prompts leaking to a server we run | **Defended (no backend)** | There is no backend. Requests go directly to the provider APIs on the `connect-src` allowlist. |

## Storage formats

- `enc:v2:` (current): `b64(iv).b64(ct)`. The AES key is derived once per unlock
  from the passphrase + the per-install salt (`borrowed:kdf-salt:v1`).
- `enc:v1:` (legacy): `b64(salt).b64(iv).b64(ct)`, self-contained salt, key
  re-derived from the raw passphrase per call. Still readable for back-compat; the
  unlock-time migration sweep rewrites any v1 blob to v2.

### Salt-missing-but-v2-present

If a v2 blob exists but the KDF salt is gone (cleared/corrupt), the keys are
**unrecoverable** — no passphrase can re-derive the original key. The app fails
loud in this case (a clear "clear and re-enter" message) and never loops the
passphrase prompt, which would otherwise derive a fresh useless key forever.
