#!/usr/bin/env bash
# Rung 3 of the ladder: this repository's full verification set.
#
# One of the ladder's two extension points, and the reason scripts/ladder.sh never needs a
# local edit. Invoked by scripts/ladder.sh, never directly by CI: CI runs the ladder, so the
# agent and CI execute the same entrypoint by construction and "green locally, red in CI"
# can only mean environment.
#
# What this repo canNOT verify here, stated because overstating coverage is what stops the
# next reader checking by hand:
#   · Playwright e2e (`npm run test:e2e`, `npm run test:e2e:prod`) is a separate CI job. It
#     needs a browser and, locally, PW_CHROMIUM — which the session bootstrap exports. Run
#     it by hand when a change touches the game flow.
#   · Real-provider behaviour (LLM / image / TTS calls with a live key), on-device audio and
#     anything needing a real browser is owner-verified through the Owner queue. No rung
#     here touches a network provider.

set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FAILS=0
step() { printf '\n   · %s\n' "$1"; }
bad() {
	printf '     FAIL %s\n' "$1"
	FAILS=$((FAILS + 1))
}

# The supply-chain tripwires run FIRST, before anything that could execute a lifecycle
# script: a poisoned lockfile (a new install script, a banned family, a planted
# binding.gyp) has to be caught before it runs, not after. Zero-dependency by design.
step "supply-chain guard"
npm run guard || bad "supply-chain guard"

step "typecheck + lint (tsc --noEmit, eslint)"
npm run check || bad "typecheck + lint"

step "unit tests + coverage (vitest)"
npm test || bad "unit tests"

step "production build (vite)"
npm run build || bad "build"

# The harness's own fixture suite for the ladder's guards. A guard that false-passes is
# worse than no guard, so it is verified rather than assumed. Not a guards-only rung: it
# builds throwaway git repos and is far too slow for the seconds-long docs path.
step "ladder guard fixtures (shipped suite)"
bash scripts/test-ladder-guards.sh >/dev/null 2>&1 || {
	bash scripts/test-ladder-guards.sh
	bad "ladder guard fixtures"
}

if [ "$FAILS" -gt 0 ]; then
	printf '\n   verification set: %d failure(s)\n' "$FAILS"
	exit 1
fi
printf '\n   verification set: clean\n'
