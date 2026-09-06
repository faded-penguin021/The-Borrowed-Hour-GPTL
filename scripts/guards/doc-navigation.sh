#!/usr/bin/env bash
# Repo-local guard: the constitution/runbook split must stay navigable.
#
# Rules that used to live in CLAUDE.md now live in docs/RUNBOOK.md, and rules that used to
# live in docs/STATE.md's preamble now live in the runbook too. A relocation is only NOT a
# repeal for as long as the reader can still get there: the destination heading has to exist,
# AND the pointer left behind has to survive. AMH 9.2.0 is explicit that guarding the heading
# alone is the hole — the pointer is then deletable in silence, and the rule it leads to
# becomes unreachable without anything going red.
#
# So each row below is a PAIR: a heading that must exist in a destination file, and a pointer
# that must exist in a source file. Both directions fail. Nothing here reads the CONTENT of
# either side; a heading kept over an emptied section still passes, which is the reviewer's
# problem and is stated rather than implied.
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

fails=0

need_heading() { # <file> <exact heading line>
	if [ ! -f "$1" ]; then
		printf '%s is missing — the runbook tier is declared in amh.conf RULE_FILES and .gitattributes\n' "$1"
		fails=$((fails + 1))
		return
	fi
	if ! grep -qxF "$2" "$1"; then
		printf '%s has no heading %s — a pointer somewhere now leads nowhere\n' "$1" "$2"
		fails=$((fails + 1))
	fi
}

need_pointer() { # <file> <substring> <what it points at>
	if ! grep -qF "$2" "$1"; then
		printf '%s lost its pointer to %s — the rule is still there but nothing leads to it, which is how a relocation finishes becoming a repeal\n' "$1" "$3"
		fails=$((fails + 1))
	fi
}

need_heading docs/RUNBOOK.md '## Working-memory compression'
need_heading docs/RUNBOOK.md '## Session discipline (binding for every session)'
need_heading docs/RUNBOOK.md '## Fresh-context review (the sanctioned subagent)'
need_heading docs/RUNBOOK.md '## Acceptance ladder'
need_heading docs/RUNBOOK.md '## Incident: leaked credential'
need_heading docs/RUNBOOK.md '## Supply-chain hygiene (read before touching deps or running installs)'

need_pointer docs/STATE.md   'docs/RUNBOOK.md` → **Working-memory compression**' 'the compression rules'
need_pointer docs/STATE.md   'docs/RUNBOOK.md` → Session discipline 5'           'the Owner-queue rules'
need_pointer docs/LEDGER.md  'docs/RUNBOOK.md` → Fresh-context review'           'the review protocol'
need_pointer CLAUDE.md       '**Working-memory compression**'                    'the compression rules'
need_pointer CLAUDE.md       '**Session discipline**'                            'the session protocol'
need_pointer CLAUDE.md       '**Fresh-context review**'                          'the review protocols'
need_pointer CLAUDE.md       '**Acceptance ladder**'                             'the ladder playbook'
need_pointer CLAUDE.md       '**Supply-chain hygiene**'                          'the supply-chain playbook'

if [ "$fails" -gt 0 ]; then
	printf '%d navigation break(s) between the constitution, the runbook and the memory tiers.\n' "$fails"
	exit 1
fi
printf 'constitution/runbook navigation intact (6 heading(s), 8 pointer(s))\n'
