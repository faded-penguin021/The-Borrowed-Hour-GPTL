#!/usr/bin/env bash
# Repo-local guard: a `D-NNN` written in PROSE must resolve to a real ledger row.
#
# The shipped citation guard scans CITATION_SCAN_PATHS — code and workflows — and
# deliberately leaves docs out, because in most repos prose mentions an ID without citing
# it. This one does not: `CLAUDE.md` and `docs/STATE.md` cite rows as load-bearing
# justification — a rule is repeatedly qualified by "superseded by it", "not a precedent",
# with a bare row ID carrying the whole argument — and a dangling one there misleads
# exactly the reader the ledger exists for. That half of the pre-AMH ladder's citation
# check has no home in the shipped guard, so it lives here.
#
# No row ID is written out anywhere in this file, deliberately. This script sits inside
# CITATION_SCAN_PATHS, so an ID quoted here as an EXAMPLE is read by the shipped guard as
# a real code citation and demands a `[cited]` marker the row has not earned — the same
# trap the shipped scripts avoid by naming harness rows in a form the scanner cannot read.
#
# TWO things this checks that the shipped guard does not:
#   1. docs and root-level markdown are in scope at all;
#   2. existence resolves against the file the PREFIX names — `D-NNN` in docs/LEDGER.md,
#      `DA-NNN` in docs/LEDGER_A.md, and so on — so a rollover cannot quietly void it by
#      letting a row in one volume satisfy a citation of another.
#
# What it deliberately does NOT do is touch the `[cited]` markers. Those track CODE
# citations only, and are the shipped guard's to keep in sync in both directions; a prose
# mention adding a marker would make every marker meaningless.
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

# The ledger files themselves are excluded: they DEFINE rows, and the rollover header
# names future prefixes illustratively — neither is a citation.
cited=$(grep -rhoE '\bD[A-Z]?-[0-9]{3}\b' --include='*.md' --exclude='LEDGER*.md' \
	docs ./*.md 2>/dev/null | sort -u)

if [ -z "$cited" ]; then
	printf 'no prose citations to resolve\n'
	exit 0
fi

fails=0
for id in $cited; do
	suffix=${id#D}
	suffix=${suffix%%-*}
	target="docs/LEDGER${suffix:+_$suffix}.md"
	if ! grep -qE "^- ${id}( \[cited\])?:" "$target" 2>/dev/null; then
		printf '%s is cited in prose but has no row in %s\n' "$id" "$target"
		fails=$((fails + 1))
	fi
done

if [ "$fails" -gt 0 ]; then
	printf '%d dangling prose citation(s) — add the row, or stop citing it.\n' "$fails"
	exit 1
fi
printf '%s prose citation(s) resolve\n' "$(printf '%s\n' "$cited" | wc -l | tr -d ' ')"
