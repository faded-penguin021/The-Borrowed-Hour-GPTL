#!/usr/bin/env bash
# Repo-local guard: the registry-install rail's own self-test.
#
# The shipped ladder self-tests the two rails IT ships (redact.sh, command-guard.sh). The
# install rail is this repo's own (see scripts/install-guard.sh for why it is separate),
# so nothing shipped knows to exercise it — and a silently regressed rail is no rail. This
# rung is the extension point that closes that gap.
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

if [ ! -f scripts/install-guard.sh ]; then
	printf 'scripts/install-guard.sh is missing — this repo has NO registry-install rail, and its absence is a failure rather than a skip (CLAUDE.md → Supply-chain hygiene).\n'
	exit 1
fi

if ! out=$(bash scripts/install-guard.sh --self-test 2>&1); then
	printf '%s\n' "$out"
	exit 1
fi
printf 'install rail self-test ok\n'
