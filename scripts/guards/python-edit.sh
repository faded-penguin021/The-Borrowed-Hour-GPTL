#!/usr/bin/env bash
# Repo-local PRE-EXECUTION advisory — inline Python used to edit files.
#
# NOT PART OF AMH. The shipped command guard carries no such rail, so this one sits beside it
# as an additional PreToolUse hook rather than being patched into it — the same arrangement,
# and for the same reason, as this repo's registry-install rail (scripts/install-guard.sh).
# It is ours: editable freely, absent from scripts/MANIFEST.sha256, and untouched by an AMH
# upgrade. It lives under scripts/guards/ so the ladder runs its fixture matrix every run.
#
# WHY IT EXISTS, from this repo's own history. The harness supplies Write and Edit. Those
# render a reviewable diff, and a failed match is an error rather than a silence. A
# `python3 - <<'PY'` heredoc that rewrites the same file is opaque while it runs: the
# transcript shows a blob of Python, the tool result shows nothing, and whether the edit did
# what it claimed is knowable only afterwards by reading the file back. D-027 is the local
# incident — a scripted edit asserted one string was present and then rewrote a DIFFERENT one,
# so `replace` no-opped while the assert passed, the guard reported success, and the false
# claim reached a commit body. Edit would have failed loudly on the same mistake.
#
# IT BLOCKS EXACTLY ONCE, then stays out of the way. Same mechanism and rationale as the
# shipped command guard's dotenv and destructive-command advisories: a marker file per repo
# and uid under /tmp. Strictly it is once per MARKER LIFETIME — the marker name carries no
# session component. In this repo's remote containers scripts/bootstrap.sh clears it at
# session start, which makes the two coincide there; on a long-lived machine where bootstrap
# does not run, the first session to trip it spends it for every later one. Delete the marker
# to re-arm. That is deliberate: this is a speed bump aimed at a reflex, not a permission
# rail. Scripted bulk edits are a legitimate tool and the session that genuinely needs one
# gets it by re-running the command.
#
# WHAT IT MATCHES: a Python invocation carrying INLINE source (`-c`, or a heredoc / pipe into
# `python -`) whose source text contains a file-write operation. All three must hold.
#
# WHAT IT DOES NOT MATCH, stated plainly because a coverage claim nobody checks is worse than
# no claim:
#   * `python script.py`, and equally `cat edit.py | python3` — the source is a file, not the
#     command text. A checked-in script is reviewable on its own terms, which is the property
#     this advisory protects; it is also invisible to a matcher that only sees the command
#     line. Writing the script and then running it therefore passes, and that is the intended
#     shape for an edit big enough to want a script.
#   * `sed -i`, `perl -pi -e`, `ed`, `awk` into a temp file, a shell redirection that clobbers
#     a source file. Same opacity, same objection — but the rule this implements is about
#     Python, and widening a rule past what it says is how rules stop being read. Widening it
#     is a rule change and takes the rule-review protocol, as adding it did.
#   * Anything constructed at runtime — `eval`, base64, a command assembled from variables.
#     Text at scan time is not code; the shipped command guard's header makes the same
#     admission about its own scanners.
#   * The SECOND and later inline-Python edit per marker lifetime. By design, see above.
#   * Pure filesystem moves — `os.makedirs`, `os.rename`, `os.replace`, `shutil.move`. The
#     remedy this advisory offers is Edit or Write, and the harness has no tool that makes a
#     directory or deletes a file, so blocking those would name a fix nobody could take.
#     Destructive shell work belongs to the shipped command guard's advisory, not this one.
#     The four content-overwriting copies stay — `shutil.copy`, `copy2`, `copyfile`,
#     `copytree` — because they overwrite file CONTENT, which is the thing being protected.
#     Note `copy` is a prefix of `copyfile`, so an alternation naming only the long spellings
#     silently drops the shorter, likelier forms; the trailing `(` is what keeps `copymode`
#     and `copystat`, which touch metadata rather than content, out.
# So: an advisory that catches the common shape once. It is not a containment boundary, and
# nothing here should be read as one.
#
# Matching is deliberately COARSE — the whole command text, not a parse. A commit message
# quoting `python -c "open('f','w')"` trips it. That is an accepted cost at a one-time
# advisory whose remedy is running the command again, and it is the same trade the shipped
# dotenv advisory makes by matching the filename anywhere in the command. A precise matcher
# here would be a Python parser written in bash.
#
# Modes:
#   python-edit.sh                 fixture matrix (the ladder rung — a matcher nobody tests
#                                  is a matcher that quietly stops matching)
#   python-edit.sh --hook          read a PreToolUse payload (JSON) on stdin; exit 2 to block
#   python-edit.sh --command 'CMD' check one command; exit 2 if it would advise
#
# Fails OPEN on anything it cannot parse, like every other pre-execution rail here: a guard
# that bricks unrelated commands is one the next session deletes rather than fixes.
#
# Tier: the LADDER mode fails closed (a broken matcher is a broken guard). The HOOK mode
# blocks once and then passes forever, which is a nudge rather than a tier. Deliberate.
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

ADVICE='This command uses inline Python to edit a file. The harness supplies Write and Edit, which show the change as a reviewable diff and fail loudly when a match is missed; an interpreter heredoc is opaque while it runs, so a mistake in it is only visible afterwards by reading the file back — this repo has shipped exactly that bug (D-027), where a replace silently no-opped while its own assert passed. Prefer Edit for a targeted replacement or Write for a whole file. The guard is stopping this ONCE so you can reconsider — if a scripted bulk edit is genuinely the right tool here, run the same command again and it will proceed; this advisory does not rearm until its marker under /tmp is cleared.'

# --- the matcher ------------------------------------------------------------------------------

# True (0) if the command invokes Python with inline source that writes to a file.
is_python_inline_edit() { # <command>
	local cmd=$1 src

	# 1. A Python invocation at all. Word-boundary matched so `pythonic-notes.md` is prose. `/`
	#    is NOT a boundary character: excluding it would let `/usr/bin/python3` and
	#    `.venv/bin/python` through, which is the first spelling anyone reaches for.
	printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_.-])(python|python3|python2|py)([[:space:]]|$)' || return 1

	# 2. Inline source: `-c`, or a heredoc / pipe feeding the interpreter on stdin. Without one
	#    of these the source lives in a file this matcher cannot see, and a checked-in script is
	#    not what this advisory is aimed at. Interpreter flags may sit between the interpreter
	#    and `-c` (`-u`, `-B`, `-X utf8`), so the inline-source token is not required to be
	#    adjacent.
	printf '%s' "$cmd" | grep -Eq -- '(python|python3|python2|py)[[:space:]]+((-[[:alnum:]]+[[:space:]]+([[:alnum:]=.]+[[:space:]]+)?)*(-[[:alnum:]]*c|-[[:space:]]*$|-[[:space:]])|.*<<)' ||
		printf '%s' "$cmd" | grep -Eq -- '\|[[:space:]]*(python|python3|python2|py)([[:space:]]|$)' || return 1

	# 3. A write in the source text. Standard-stream writes are how a legitimate read-and-report
	#    one-liner prints, so they are removed before the test rather than special-cased inside
	#    it — `sys.stdout.write` must not be the thing that trips a guard about editing files.
	src=$(printf '%s' "$cmd" | sed -e 's/sys\.stdout\.write(//g' -e 's/sys\.stderr\.write(//g' -e 's/stdout\.write(//g' -e 's/stderr\.write(//g')

	printf '%s' "$src" | grep -Eq \
		-e "open\([^)]*,[[:space:]]*['\"][^'\"]*[wax+]" \
		-e '\.write\(' \
		-e '\.writelines\(' \
		-e '\.write_text\(' \
		-e '\.write_bytes\(' \
		-e '\.truncate\(' \
		-e 'shutil\.(copy|copy2|copyfile|copytree)\(' \
		-e 'inplace[[:space:]]*=[[:space:]]*True' \
		-e '(json|yaml|toml)\.dump\(' \
		-e 'Path\([^)]*\)\.write' ||
		return 1

	return 0
}

# --- one-time state ---------------------------------------------------------------------------
#
# Mirrors the shipped command guard's advisory-state file: per repo, per uid, under /tmp.
# The prefix is this repo's own, NOT `amh-`, because the shipped bootstrap's cleanup enumerates
# the harness's own marker names and must not be expected to know about ours — clearing it is
# scripts/bootstrap.sh's job here. PYTHON_EDIT_ADVISORY_STATE overrides the path, which is how
# the fixture suite exercises both the armed and disarmed paths without touching the real
# marker.
advisory_state_file() {
	local slug uid
	# `:-` not `+x`, so an exported-but-EMPTY override falls back to the real marker instead of
	# returning "" and disarming the rail silently.
	[ -n "${PYTHON_EDIT_ADVISORY_STATE:-}" ] && { printf '%s' "$PYTHON_EDIT_ADVISORY_STATE"; return 0; }
	slug=${ROOT//\//_}
	slug=${slug// /_}
	uid=${UID:-unknown}
	printf '/tmp/borrowed-python-edit-advisory-%s-%s' "$uid" "$slug"
}

# True (0) if this command should be advised against right now: it matches AND the advisory is
# still armed. Arming is consumed here, so a second call passes even for the same command.
needs_advisory() { # <command>
	local state
	is_python_inline_edit "$1" || return 1
	state=$(advisory_state_file)
	[ -n "$state" ] || return 1
	[ -e "$state" ] && return 1
	: >"$state" 2>/dev/null || return 1
	return 0
}

# --- hook mode --------------------------------------------------------------------------------

extract_command() { # fail open: print nothing if the payload is not what we expect
	# No python3 here on purpose — a guard about reaching for Python should not need it to run,
	# and the sed path is the one the shipped guard already falls back to.
	#
	# The capture must stop at the END OF THE STRING, not the last quote on the line. A greedy
	# `\(.*\)"` would swallow every sibling field, so the model-written `description` that
	# follows `command` in the Bash payload would be scanned as if it were the command — and a
	# description merely MENTIONING Python would block an unrelated command.
	# `[^"\\]*(\\.[^"\\]*)*` consumes escaped quotes without running past the closing one.
	printf '%s' "$1" |
		sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"\\]*\(\\.[^"\\]*\)*\)".*/\1/p' |
		head -1
}

if [ "${1:-}" = "--hook" ]; then
	payload=$(cat) || exit 0
	cmd=$(extract_command "$payload")
	[ -n "$cmd" ] || exit 0
	if needs_advisory "$cmd"; then
		printf 'BLOCKED ONCE by the repo-local inline-Python advisory (CLAUDE.md -> Conventions).\n\n%s\n' "$ADVICE" >&2
		exit 2
	fi
	exit 0
fi

if [ "${1:-}" = "--command" ]; then
	cmd=${2:-}
	if needs_advisory "$cmd"; then
		printf '%s\n' "$ADVICE" >&2
		exit 2
	fi
	exit 0
fi

if [ -n "${1:-}" ]; then
	printf 'usage: %s [--hook | --command <CMD>]\n' "$0" >&2
	exit 3
fi

# --- ladder mode: the fixture matrix ----------------------------------------------------------
#
# The hook cannot be verified from inside the repo — nothing here can prove Claude Code still
# fires it. What CAN be verified is that the matcher still recognises what it claims to, so that
# is what this rung does. Arming is bypassed with a throwaway state path, because these cases
# test the MATCHER, not the one-time bookkeeping (which gets its own cases below).
SELF_FAILS=0
MATCHED=0
PASSED=0
matcher_says_yes() { # <label> <command>
	MATCHED=$((MATCHED + 1))
	if ! is_python_inline_edit "$2"; then
		printf 'python-edit: matcher MISSED %s: %s\n' "$1" "$2" >&2
		SELF_FAILS=$((SELF_FAILS + 1))
	fi
}
matcher_says_no() { # <label> <command>
	PASSED=$((PASSED + 1))
	if is_python_inline_edit "$2"; then
		printf 'python-edit: matcher FALSE POSITIVE on %s: %s\n' "$1" "$2" >&2
		SELF_FAILS=$((SELF_FAILS + 1))
	fi
}

# Shapes that ARE an inline Python file edit. The first is the exact shape D-027 came from.
matcher_says_yes 'heredoc rewrite (the D-027 shape)' "python3 - <<'PY'
s = open('CLAUDE.md').read()
open('CLAUDE.md','w').write(s)
PY"
matcher_says_yes 'dash-c open-for-write' "python3 -c \"open('docs/STATE.md','w').write('x')\""
matcher_says_yes 'pathlib write_text' "python3 -c 'from pathlib import Path; Path(\"a\").write_text(\"b\")'"
matcher_says_yes 'fileinput inplace' "python -c 'import fileinput
for l in fileinput.input(\"f\", inplace=True): print(l)'"
matcher_says_no 'shutil move is a filesystem op, not an edit' "python3 -c 'import shutil; shutil.move(\"a\",\"b\")'"
# `copy` is a prefix of `copyfile`, so an alternation naming only the long spellings matches
# neither short one. All four overwrite destination CONTENT; copymode/copystat do not.
matcher_says_yes 'shutil copy overwrites content' "python3 -c 'import shutil; shutil.copy(\"a.ts\",\"b.ts\")'"
matcher_says_yes 'shutil copy2 overwrites content' "python3 -c 'import shutil; shutil.copy2(\"a.ts\",\"b.ts\")'"
matcher_says_yes 'shutil copyfile overwrites content' "python3 -c 'import shutil; shutil.copyfile(\"a.ts\",\"b.ts\")'"
matcher_says_no 'shutil copymode touches metadata, not content' "python3 -c 'import shutil; shutil.copymode(\"a.ts\",\"b.ts\")'"
matcher_says_no 'os.replace is a filesystem op, not an edit' "python3 -c 'import os; os.replace(\"a\",\"b\")'"
matcher_says_yes 'piped inline source' "echo \"open('a','w').write('x')\" | python3"
matcher_says_yes 'json dump' "python3 -c 'import json; json.dump(d, open(\"f\",\"w\"))'"

# The spellings a naive matcher misses. An absolute path and an interpreter flag before -c are
# what a real session types, so a guard blind to them is advisory theatre against everything but
# the textbook form.
matcher_says_yes 'absolute interpreter path' "/usr/bin/python3 -c \"open('a','w').write('x')\""
matcher_says_yes 'venv-relative interpreter' ".venv/bin/python -c \"open('a','w').write('x')\""
matcher_says_yes 'flag before -c' "python3 -u -c \"open('a','w').write('x')\""
matcher_says_yes 'valued flag before -c' "python3 -X utf8 -c \"open('a','w').write('x')\""

# Shapes that are NOT, and must stay quiet. These decide whether the guard survives contact
# with a real session in THIS repo.
matcher_says_no 'read and print' "python3 -c 'print(open(\"src/types.ts\").read().count(chr(10)))'"
matcher_says_no 'stdout write' "python3 -c 'import sys; sys.stdout.write(\"hi\")'"
matcher_says_no 'json read' "python3 -c 'import json,sys; print(json.load(sys.stdin)[\"k\"])'"
matcher_says_no 'a script file' 'python3 scripts/check-models.py'
matcher_says_no 'a script file piped in' 'cat edit.py | python3'
matcher_says_no 'module run' 'python3 -m pytest -q'
matcher_says_no 'version' 'python3 --version'
matcher_says_no 'no python at all' "sed -i 's/a/b/' src/types.ts"
matcher_says_no 'prose mentioning python' 'git commit -m "describe the python-shaped edit reflex"'
matcher_says_no 'this repo verification' 'npm run ladder'
matcher_says_no 'this repo tests' 'npx vitest run --coverage'

# The one-time bookkeeping: armed once, then silent — the property the whole design rests on.
tmp_state=$(mktemp -u)
PYTHON_EDIT_ADVISORY_STATE=$tmp_state
edit_cmd="python3 -c \"open('a','w').write('x')\""
needs_advisory "$edit_cmd" || {
	printf 'python-edit: first matching command was NOT advised against\n' >&2
	SELF_FAILS=$((SELF_FAILS + 1))
}
if needs_advisory "$edit_cmd"; then
	printf 'python-edit: advisory rearmed on the second call — it must block exactly once\n' >&2
	SELF_FAILS=$((SELF_FAILS + 1))
fi
if needs_advisory "python3 -c \"open('b','w').write('y')\""; then
	printf 'python-edit: advisory fired for a second, different command — one block per marker\n' >&2
	SELF_FAILS=$((SELF_FAILS + 1))
fi
rm -f "$tmp_state"
unset PYTHON_EDIT_ADVISORY_STATE

# An empty override must fall back to the real marker rather than silently disarming the rail.
PYTHON_EDIT_ADVISORY_STATE=''
if [ "$(advisory_state_file)" = '' ]; then
	printf 'python-edit: an empty PYTHON_EDIT_ADVISORY_STATE disarmed the rail instead of falling back\n' >&2
	SELF_FAILS=$((SELF_FAILS + 1))
fi
unset PYTHON_EDIT_ADVISORY_STATE

# The payload capture must stop at the closing quote of "command", or a sibling field that
# merely mentions Python blocks an unrelated command.
got=$(extract_command '{"tool_input":{"command":"npm run ladder","description":"python3 -c open(1,\"w\")"}}')
if [ "$got" != 'npm run ladder' ]; then
	printf 'python-edit: extract_command ran past the closing quote, got: %s\n' "$got" >&2
	SELF_FAILS=$((SELF_FAILS + 1))
fi

if [ "$SELF_FAILS" -gt 0 ]; then
	printf 'python-edit.sh: %d matcher fixture(s) failed\n' "$SELF_FAILS" >&2
	exit 1
fi

# Counted, not typed — a hardcoded summary drifts the first time a fixture is added.
printf '%s edit shape(s) matched, %s legitimate use(s) passed, one-time arming and payload capture verified; pre-execution advisory (hook firing is not verifiable from here)\n' "$MATCHED" "$PASSED"
exit 0
