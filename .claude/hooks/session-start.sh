#!/bin/bash
# SessionStart hook: make remote agent sessions test- and e2e-ready with no
# manual setup (see docs/BACKLOG.md unit H1, U1). Synchronous by design so
# dependencies are guaranteed present before the agent's first turn.
set -euo pipefail

# Install dependencies. npm ci (never npm install) per CLAUDE.md's
# supply-chain rules: it honors the committed lockfile exactly.
npm ci 1>&2

# Discover the container's Playwright Chromium and export it for the session so
# `npm run test:e2e` works without the manual PW_CHROMIUM override (see U1).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  pw_chromium="$(find /opt/pw-browsers -maxdepth 3 -name chrome -o -maxdepth 3 -name headless_shell 2>/dev/null | head -1)"
  if [ -n "$pw_chromium" ]; then
    echo "export PW_CHROMIUM=\"$pw_chromium\"" >> "$CLAUDE_ENV_FILE"
  fi
fi
