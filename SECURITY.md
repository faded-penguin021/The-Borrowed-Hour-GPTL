# Security Policy

## Supported versions

Security fixes are handled on the default branch. If release branches or tagged maintenance versions are introduced later, this policy should be updated to list them.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Instead, report it privately to the project maintainers through the repository host's private vulnerability reporting feature, if available, or by contacting a maintainer directly.

Include as much detail as you can safely share:

- A description of the issue and affected feature.
- Steps to reproduce or proof-of-concept details.
- Expected impact and any known mitigations.
- Whether any API keys, local data, or third-party provider credentials may be exposed.

## Handling secrets

The app asks users to enter provider API keys in the browser. Contributors should avoid logging keys, committing local configuration, or adding telemetry that captures prompts, responses, credentials, or saved-game data without explicit user consent.

### What the encryption does and does not protect

Stored keys are encrypted at rest (AES-GCM, PBKDF2-SHA-256 at 310k iterations,
keyed from a session passphrase + a per-install salt). Be precise about the
guarantee: **encryption-at-rest defends a passive read of browser storage — it
does not defend against code running on the page.** While a session is unlocked,
in-page script can use the derived key to decrypt, exactly as the app does. The
real anti-XSS defenses are the strict CSP, the absence of `innerHTML`/`eval`, and
the bring-your-own-key model.

The session secret held in memory is a **non-extractable** `CryptoKey`, not the
raw passphrase: its bytes cannot be exported even by in-page script, and it is
dropped on lock, on tab-background (auto-lock), and after an absolute session cap.

See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the full per-surface table
(passphrase, at-rest, localStorage/IndexedDB, XSS, CSP scope, third-party
`js.puter.com`), the stated assumptions, and the explicit non-goal.
