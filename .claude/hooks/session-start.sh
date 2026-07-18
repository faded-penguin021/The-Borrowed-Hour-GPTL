#!/bin/bash
# SessionStart hook: make remote agent sessions test- and e2e-ready with no
# manual setup (see docs/BACKLOG.md unit H1, U1). Synchronous by design so
# dependencies are guaranteed present before the agent's first turn.
set -euo pipefail

# Supply-chain tripwires BEFORE the install, so a poisoned lockfile (new
# install script, banned family, planted config file) is caught before npm ci
# can execute any lifecycle script. The guard is zero-dependency by design.
node scripts/check-supply-chain.mjs 1>&2

# Install dependencies. npm ci (never npm install) per CLAUDE.md's
# supply-chain rules: it honors the committed lockfile exactly.
npm ci 1>&2

# Re-run after the install for the node_modules sweep (binding.gyp tripwire).
node scripts/check-supply-chain.mjs 1>&2

# Discover the container's Playwright Chromium and export it for the session so
# `npm run test:e2e` works without the manual PW_CHROMIUM override (see U1).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  pw_chromium="$(find /opt/pw-browsers -maxdepth 3 -name chrome -o -maxdepth 3 -name headless_shell 2>/dev/null | head -1)"
  if [ -n "$pw_chromium" ]; then
    echo "export PW_CHROMIUM=\"$pw_chromium\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

# Branch check: the first misplaced commit is the expensive one. Warn loudly on
# main or a detached HEAD so the session cuts a claude/<codename> branch first.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [ "$branch" = "main" ]; then
  echo "session-start: WARNING — on 'main'. Cut a claude/<codename> branch before committing (pushes to main are denied)." 1>&2
elif [ "$branch" = "HEAD" ]; then
  echo "session-start: WARNING — detached HEAD. Check out a branch before committing." 1>&2
fi

# Protocol pointer + STATE size vs its soft cap, so the session knows to
# compress BEFORE writing if working memory is already near the cap.
if [ -f docs/STATE.md ]; then
  kb=$(( ( $(wc -c < docs/STATE.md) + 1023 ) / 1024 ))
  echo "session-start: read docs/STATE.md first (${kb} KB, soft cap 8 KB), then the CLAUDE.md 'Session discipline' section. Verify with scripts/ladder.sh." 1>&2
else
  echo "session-start: read docs/STATE.md first, then the CLAUDE.md 'Session discipline' section. Verify with scripts/ladder.sh." 1>&2
fi
