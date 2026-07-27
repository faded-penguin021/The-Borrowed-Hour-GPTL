#!/bin/bash
# Claude Code SessionStart adapter. WIRING ONLY — the boot sequence itself is
# scripts/session-start.sh (shipped by AMH) and the toolchain install is
# scripts/bootstrap.sh (this repo's). Adding another agent should rewrite nothing
# behavioural; that is the whole reason this file is three steps long.
#
# Two things here are genuinely Claude-specific and cannot move:
#   1. AMH_REMOTE=1. Every Claude Code session on this repo runs in a fresh, ephemeral
#      container that starts with no node_modules, which is exactly the state the flag
#      names — and the pre-AMH hook installed unconditionally for the same reason. A local
#      run of scripts/session-start.sh by hand stays silent unless the flag is set
#      deliberately.
#   2. CLAUDE_ENV_FILE. Exporting a variable into the rest of the session needs an
#      env-file the harness sources, and only this harness has one.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(dirname "$0")/../.."

AMH_REMOTE=1 bash scripts/session-start.sh 1>&2

# Discover the container's Playwright Chromium and export it for the session, so
# `npm run test:e2e` works without a manual PW_CHROMIUM override. Playwright e2e is not a
# ladder rung — it is a separate CI job — so this is what makes running it by hand cheap.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
	pw_chromium="$(find /opt/pw-browsers -maxdepth 3 -name chrome -o -maxdepth 3 -name headless_shell 2>/dev/null | head -1)"
	if [ -n "$pw_chromium" ]; then
		echo "export PW_CHROMIUM=\"$pw_chromium\"" >>"$CLAUDE_ENV_FILE"
	fi
fi
