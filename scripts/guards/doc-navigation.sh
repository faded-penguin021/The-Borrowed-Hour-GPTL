#!/usr/bin/env bash
# Repo-local guard: the constitution/runbook split must stay navigable.
#
# Rules that used to live in CLAUDE.md now live in docs/RUNBOOK.md, and rules that used to
# live in docs/STATE.md's preamble now live there too. A relocation is only NOT a repeal for
# as long as a reader can still get there: the destination heading has to exist, AND the
# pointer left behind has to survive. AMH 9.2.0 names guarding the heading alone as the hole —
# the pointer is then deletable in silence and the rule becomes unreachable with nothing red.
#
# Every row below is therefore a PAIR, and there are no unpaired rows: a destination heading
# and a pointer that must name the destination FILE, not merely repeat the section's title in
# bold. That last part is the fix for a real false green — a pointer reduced to a bare bold
# phrase leaves the destination unnameable from the source while a title-only match stays
# happy. Headings are matched on a stable stem rather than the whole line, so re-wording a
# parenthetical does not fail; a pointer is matched on the file name and the section title
# together.
#
# What this canNOT do, said plainly so a green line is not read as more than it is: it never
# opens the destination section, so a heading kept over an emptied body passes, and it cannot
# tell a pointer that leads somewhere useful from one that merely mentions the right words.
# That half is the reviewer's.
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

# Escape a literal for use inside an extended regex.
re() { printf '%s' "$1" | sed 's/[][\.^$*+?(){}|\/]/\\&/g'; }

fails=0 pairs=0

# pair <dest-file> <heading stem> <source file> [<source file>...]
# EVERY source file listed must contain the destination file name AND the heading stem.
pair() {
	local dest=$1 stem=$2
	shift 2
	pairs=$((pairs + 1))

	if [ ! -f "$dest" ]; then
		printf '%s is missing — it is declared in amh.conf RULE_FILES and .gitattributes\n' "$dest"
		fails=$((fails + 1))
		return
	fi
	if ! grep -qE "^## ${stem}" "$dest"; then
		printf '%s has no "## %s" heading — every pointer to it now leads nowhere\n' "$dest" "$stem"
		fails=$((fails + 1))
	fi

	# EVERY listed source must keep its own pointer, not just one of them. Accepting any
	# single survivor lets the always-read file lose its pointer while a second file masks
	# the break — which is precisely the false green this guard was rewritten to catch.
	local src
	for src in "$@"; do
		if [ ! -f "$src" ]; then
			printf '%s is missing — it was carrying a pointer to %s → %s\n' "$src" "$dest" "$stem"
			fails=$((fails + 1))
			continue
		fi
		# Match the pointer FORM — destination, arrow, section — not the two strings
		# independently. The constitution names docs/RUNBOOK.md and quotes section titles
		# in several unrelated places (the sanction inventory lists most of them), so a
		# pair of independent greps stays green on a file whose pointer is gone. The arrow
		# is what separates a pointer from a mention. Lines are flattened first because a
		# pointer often wraps across two of them, and one arrow may serve two sections
		# ("→ **Acceptance ladder** and **When CI fails**"), hence the window.
		if ! tr '\n' ' ' <"$src" | tr -s ' ' | grep -qE "$(re "$dest")[^A-Za-z0-9]{0,4}→.{0,120}$(re "$stem")"; then
			printf '%s lost its pointer to %s → %s — the rule is still there but this file no longer names its home, which is how a relocation finishes becoming a repeal\n' \
				"$src" "$dest" "$stem"
			fails=$((fails + 1))
		fi
	done
}

pair docs/RUNBOOK.md 'Session discipline'       CLAUDE.md docs/STATE.md
pair docs/RUNBOOK.md 'Working-memory compression' CLAUDE.md docs/STATE.md
pair docs/RUNBOOK.md 'Fresh-context review'     CLAUDE.md docs/LEDGER.md
pair docs/RUNBOOK.md 'Acceptance ladder'        CLAUDE.md
pair docs/RUNBOOK.md 'When CI fails'            CLAUDE.md
pair docs/RUNBOOK.md 'Supply-chain hygiene'     CLAUDE.md
pair docs/RUNBOOK.md 'Incident: leaked credential' CLAUDE.md

if [ "$fails" -gt 0 ]; then
	printf '%d navigation break(s) between the constitution, the runbook and the memory tiers.\n' "$fails"
	exit 1
fi
printf 'checked %d heading/pointer pair(s); each destination heading exists and is named by a surviving pointer\n' "$pairs"
