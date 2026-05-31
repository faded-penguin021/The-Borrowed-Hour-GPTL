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
