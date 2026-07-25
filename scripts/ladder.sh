#!/usr/bin/env bash
# The one verification entrypoint — run by both the agent and CI (see CLAUDE.md).
# A fast STATE-length guard first, then the full verification set in a single
# invocation, so "green locally" and "green in CI" can't diverge.
#
#   scripts/ladder.sh                # guard + typecheck + lint + test + build
#   scripts/ladder.sh --guards-only  # STATE-length guard only (docs-only work)
set -euo pipefail

cd "$(dirname "$0")/.."

# ── Guard: docs/STATE.md length (hysteresis + landing check) ─────────────
# Working memory is read first every session, so it must stay small. The band
# between COMPRESS_TO_KB and WARN_KB is the debounce: trimming to just under the
# warn line re-arms it a session later (D-005), so a compression that starts
# above the warn line must LAND at or below the floor. Keep these constants in
# lockstep with the prose in docs/STATE.md's own length guard.
STATE_FILE="docs/STATE.md"
COMPRESS_TO_KB=9
WARN_KB=14
HARD_KB=16
if [ -f "$STATE_FILE" ]; then
  bytes=$(wc -c < "$STATE_FILE")
  kb=$(( (bytes + 1023) / 1024 ))
  if [ "$bytes" -gt $(( HARD_KB * 1024 )) ]; then
    echo "ladder: FAIL — $STATE_FILE is ${kb} KB (hard cap ${HARD_KB} KB). Compress to ≤ ${COMPRESS_TO_KB} KB before committing." >&2
    exit 1
  elif [ "$bytes" -gt $(( WARN_KB * 1024 )) ]; then
    echo "ladder: warn — $STATE_FILE is ${kb} KB (warn line ${WARN_KB} KB). Run ONE deep compression pass to ≤ ${COMPRESS_TO_KB} KB (not just under the warn line)." >&2
  fi

  # Landing check: only fires on a shrink out of warn territory, so growth and
  # sub-warn edits never trip it. Compare against the committed size — working
  # tree vs HEAD, falling back to HEAD~1 for a just-committed trim.
  prev_bytes=""
  for ref in HEAD HEAD~1; do
    if prev=$(git show "$ref:$STATE_FILE" 2>/dev/null); then
      candidate=$(printf '%s' "$prev" | wc -c)
      if [ "$candidate" -ne "$bytes" ]; then prev_bytes="$candidate"; break; fi
      prev_bytes="$candidate"
    fi
  done
  if [ -n "$prev_bytes" ] \
     && [ "$prev_bytes" -gt $(( WARN_KB * 1024 )) ] \
     && [ "$bytes" -le $(( WARN_KB * 1024 )) ] \
     && [ "$bytes" -gt $(( COMPRESS_TO_KB * 1024 )) ]; then
    echo "ladder: FAIL — $STATE_FILE was compressed out of warn territory but landed at ${kb} KB, inside the ${COMPRESS_TO_KB}–${WARN_KB} KB debounce band. Compress to ≤ ${COMPRESS_TO_KB} KB (D-005)." >&2
    exit 1
  fi
else
  echo "ladder: warn — $STATE_FILE not found." >&2
fi

# ── Guard: docs/STATE.md structure ───────────────────────────────────────
# Over-compression tripwire: the sections a fresh session and the owner depend
# on must survive every compression pass.
if [ -f "$STATE_FILE" ]; then
  for header in "## Project" "## Current state" "## Owner queue"; do
    if ! grep -qF "$header" "$STATE_FILE"; then
      echo "ladder: FAIL — $STATE_FILE lost its '$header' section (protected from compression)." >&2
      exit 1
    fi
  done
  grep -qF "**Pending owner actions:**" "$STATE_FILE" \
    || echo "ladder: warn — $STATE_FILE has no 'Pending owner actions' entry; the owner's channel may have been compressed away." >&2
fi

# ── Guard: ledger citation integrity ─────────────────────────────────────
# Code cites bare D-NNN; every citation must resolve to a row, row numbers must
# be unique, and [cited] markers are machine-synced BOTH ways so the ledger
# always says which rows are load-bearing. Docs are excluded from the scan
# scope: prose discusses rows without being load-bearing on them.
LEDGER_FILE="docs/LEDGER.md"
LEDGER_LINE_CAP=800
if [ -f "$LEDGER_FILE" ]; then
  ledger_lines=$(wc -l < "$LEDGER_FILE")
  last_row_line=$(grep -n '^- D-[0-9]\{3\}' "$LEDGER_FILE" | tail -1 | cut -d: -f1 || true)
  if [ -n "$last_row_line" ] && [ "$last_row_line" -gt "$LEDGER_LINE_CAP" ]; then
    echo "ladder: FAIL — $LEDGER_FILE has a row starting past line ${LEDGER_LINE_CAP}. Roll over to LEDGER_A.md (DA-001)." >&2
    exit 1
  fi
  if [ "$ledger_lines" -gt $(( LEDGER_LINE_CAP - 100 )) ]; then
    echo "ladder: warn — $LEDGER_FILE is ${ledger_lines} lines, approaching the ${LEDGER_LINE_CAP}-line cap. Plan the rollover." >&2
  fi

  rows=$(grep -o '^- D-[0-9]\{3\}' "$LEDGER_FILE" | sed 's/^- //' | sort)
  dupes=$(printf '%s\n' "$rows" | uniq -d)
  if [ -n "$dupes" ]; then
    echo "ladder: FAIL — duplicate ledger row numbers: $(printf '%s' "$dupes" | tr '\n' ' ')" >&2
    exit 1
  fi

  # Citations from code (never docs, never the ledger itself).
  cited=$(grep -rhoE '\bD-[0-9]{3}\b' src scripts .claude .github 2>/dev/null | sort -u || true)
  marked=$(grep -oE '^- D-[0-9]{3} \[cited\]' "$LEDGER_FILE" | grep -oE 'D-[0-9]{3}' | sort -u || true)

  for id in $cited; do
    grep -qE "^- ${id}( \[cited\])?:" "$LEDGER_FILE" || {
      echo "ladder: FAIL — code cites ${id}, which has no row in $LEDGER_FILE." >&2
      exit 1
    }
  done
  unmarked=$(comm -23 <(printf '%s\n' $cited) <(printf '%s\n' $marked) | tr -d ' ')
  stale=$(comm -13 <(printf '%s\n' $cited) <(printf '%s\n' $marked) | tr -d ' ')
  if [ -n "$unmarked" ]; then
    echo "ladder: FAIL — cited from code but missing the [cited] marker: $(printf '%s' "$unmarked" | tr '\n' ' ')" >&2
    exit 1
  fi
  if [ -n "$stale" ]; then
    echo "ladder: FAIL — marked [cited] but no longer cited from code: $(printf '%s' "$stale" | tr '\n' ' ')" >&2
    exit 1
  fi
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
