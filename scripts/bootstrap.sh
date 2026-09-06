#!/usr/bin/env bash
# Repo-specific toolchain bootstrap. Invoked by scripts/session-start.sh when the
# environment flag named by REMOTE_FLAG in amh.conf is 1 — i.e. an ephemeral container
# that starts with no node_modules. Never a heuristic: on someone's own machine this
# should not run uninvited.
#
# Agent-neutral by construction: nothing here reads a Claude-specific variable. The one
# genuinely agent-specific step — exporting PW_CHROMIUM into the session — stays in
# .claude/hooks/session-start.sh, because only that harness has an env-file to write to.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Re-arm this repo's own one-time advisories for the new session. Their markers live under
# /tmp keyed by repo and uid with no session component, so in a container that outlives one
# session the first session to trip one would spend it for every session after. The shipped
# bootstrap clears the harness's own markers and cannot be expected to know about ours.
# Enumerated, never globbed on the repo slug: `<slug>*` would also match a sibling checkout.
rm -f "/tmp/borrowed-python-edit-advisory-${UID:-unknown}-$(printf '%s' "${ROOT//\//_}" | tr ' ' '_')"

# Supply-chain tripwires BEFORE the install, so a poisoned lockfile (a new install script,
# a banned family, a planted config file) is caught before `npm ci` can execute any
# lifecycle script. The guard is zero-dependency by design.
node scripts/check-supply-chain.mjs 1>&2

# `npm ci`, never `npm install` (CLAUDE.md → Supply-chain hygiene): it honors the
# committed lockfile exactly. scripts/install-guard.sh denies the other spellings.
npm ci 1>&2

# Re-run after the install for the node_modules sweep (the binding.gyp tripwire), which
# has nothing to look at until the tree exists.
node scripts/check-supply-chain.mjs 1>&2
