#!/usr/bin/env bash
# The one verification entrypoint — run by both the agent and CI (see CLAUDE.md).
# A fast STATE-length guard first, then the full verification set in a single
# invocation, so "green locally" and "green in CI" can't diverge.
#
#   scripts/ladder.sh                # guard + typecheck + lint + test + build
#   scripts/ladder.sh --guards-only  # STATE-length guard only (docs-only work)
set -euo pipefail

cd "$(dirname "$0")/.."

# ── Guard: docs/STATE.md length ──────────────────────────────────────────
# Working memory is read first every session, so it must stay small. Warn over
# the soft cap; fail over the hard cap so an unbounded STATE can never land.
STATE_FILE="docs/STATE.md"
SOFT_KB=8
HARD_KB=16
if [ -f "$STATE_FILE" ]; then
  bytes=$(wc -c < "$STATE_FILE")
  kb=$(( (bytes + 1023) / 1024 ))
  if [ "$bytes" -gt $(( HARD_KB * 1024 )) ]; then
    echo "ladder: FAIL — $STATE_FILE is ${kb} KB (hard cap ${HARD_KB} KB). Compress before committing (see the file's length guard)." >&2
    exit 1
  elif [ "$bytes" -gt $(( SOFT_KB * 1024 )) ]; then
    echo "ladder: warn — $STATE_FILE is ${kb} KB (soft cap ${SOFT_KB} KB). Compress soon (see the file's length guard)." >&2
  fi
else
  echo "ladder: warn — $STATE_FILE not found." >&2
fi

if [ "${1:-}" = "--guards-only" ]; then
  echo "ladder: guards-only — OK"
  exit 0
fi

# ── Full verification set (one invocation; CI runs this same script) ─────
npm run guard      # supply-chain tripwires
npm run check      # tsc --noEmit && eslint .
npm test           # vitest run --coverage
npm run build      # vite build
