#!/usr/bin/env bash
# Repo-local pre-execution rail: package installs that resolve off the registry.
#
# WHY THIS IS SEPARATE from scripts/command-guard.sh. The shipped AMH command guard
# carries four rails — force-push, pushes to the default branch, environment dumps and
# .env reads — and no registry-install rail, because that is not a harness-universal
# rule. This repo's is: the npm ecosystem has active self-propagating worms, `npm install`
# will happily resolve a freshly compromised minor past the committed lockfile, and
# `npm ci` is the only sanctioned path (CLAUDE.md → Supply-chain hygiene). Shipped scripts
# are never edited locally, so the rail lives here and is wired as a second PreToolUse
# hook beside the shipped one (D-015: an upstream adoption subtracts silently, and a rail
# that no longer exists fails nothing). It is the ONLY rail this file carries; everything
# else is the shipped guard's job, and duplicating a rail across the two would mean two
# reasons for one denial.
#
# Usage — three modes, so no agent's wiring is assumed:
#   scripts/install-guard.sh --command '<shell command>'   # neutral
#   scripts/install-guard.sh                               # PreToolUse JSON on stdin
#   scripts/install-guard.sh --self-test                   # blocked + allowed matrix
#
# Contract: exit 0 = allowed, exit 2 = blocked with the reason on stderr. Any internal
# failure or malformed input exits 0 — a guard that bricks every command gets disabled
# rather than fixed, so it fails OPEN by construction.
#
# Threat model is agent MISTAKES, not evasion. Quoting and prefix tricks are accepted
# misses; the layers beneath this one bind what this cannot.
set -uo pipefail

# Judge only the LEADING command of each simple-command segment, so text that merely
# CONTAINS an install command — a commit message, a doc string, this script's own
# --self-test — never trips it. Accepted miss: a heredoc body whose line begins with an
# install command still reads as a segment.
segments() {
	# The trailing newline is load-bearing: without it `read` hits EOF on the last
	# (often only) segment and the caller's loop body never runs — a guard that allows
	# everything while reporting success.
	printf '%s\n' "$1" | tr '\n;&|()' '\n'
}

# First non-option token at or after position $2, skipping options and the values of the
# option flags that take one. `npm --prefix ./sub install` is a thing an agent types by
# hand, so keying the rail off argv[2] alone leaves the headline rule unguarded.
first_operand() {
	printf '%s' "$1" | awk -v start="$2" '{
    for (i = start; i <= NF; i++) {
      if ($i == "-C" || $i == "--prefix" || $i == "--cwd" ||
          $i == "--loglevel" || $i == "-w" || $i == "--workspace" ||
          $i == "--filter" || $i == "--dir") { i++; continue }
      if ($i ~ /^-/) continue
      print $i; exit
    }
  }'
}

deny() {
	printf '%s\n' "$1" >&2
	exit 2
}

check_command() {
	local command="$1" segment stripped head_cmd verb
	while IFS= read -r segment; do
		# Strip leading env-var assignments so `FOO=1 npm install` still resolves to its
		# real leading command.
		stripped=$(printf '%s' "$segment" | sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*//')
		head_cmd=$(printf '%s' "$stripped" | awk '{print $1}')
		case "$head_cmd" in
		npm | pnpm | yarn | bun) ;;
		*) continue ;;
		esac
		# The opt-out is scoped to the segment that carries it, never the line: the owner
		# kept it "in its narrow and well-defined scope" (docs/STATE.md → Decided
		# non-items), and narrow is the load-bearing word.
		case "$segment" in *BORROWED_DEP_CHANGE=1*) continue ;; esac
		verb=$(first_operand "$stripped" 2)
		case "$verb" in
		install | i | add | update | up | upgrade)
			deny "Blocked by this project's supply-chain rail: \`${head_cmd} ${verb}\` resolves versions off the registry and can pull a freshly compromised minor past the committed lockfile.

This is a deterministic project hook, not a one-off permission prompt — rephrasing, quoting, or re-running the same command will be blocked identically. Do not retry it.

Use instead:
  - \`npm ci\` — the normal path; installs the lockfile exactly. Not blocked.
  - \`BORROWED_DEP_CHANGE=1 ${head_cmd} ${verb} ...\` — only when the task's stated purpose IS a dependency change. The resulting package.json / package-lock.json diff is a reviewable event (CLAUDE.md → Supply-chain hygiene).

If a bump is failing CI rather than being one you meant to make, see docs/dependabot-triage.md — most shapes are fixed in source, not by installing."
			;;
		esac
	done < <(segments "$command")
	return 0
}

# ── Self-test matrix (a rail must not regress silently) ──────────────────────
# Commands are assembled from fragments because a shell line containing the literal
# blocked strings is itself blocked by the rail under test (D-003). The deny REASON is
# asserted too, not just the verdict — a mislabelled reason teaches the wrong correction,
# which is how the earlier rail's bug got through (D-003).
self_test() {
	local failures=0 n="npm" g="git" p="pnpm"
	verdict() { # <expected: allow|deny> <command>
		local expected="$1" cmd="$2" got=allow
		(check_command "$cmd") 2>/dev/null || got=deny
		if [ "$got" = "$expected" ]; then
			printf 'ok    %-6s %s\n' "$got" "$cmd"
		else
			printf 'FAIL  %-6s %s (expected %s)\n' "$got" "$cmd" "$expected"
			failures=$((failures + 1))
		fi
	}

	verdict allow "$n ci"
	verdict allow "$n ci && $n run build"
	verdict allow "$n run ladder"
	verdict allow "$n run ${n}-install-check"
	verdict allow "npx eslint ."
	verdict deny "$n ${n:0:0}install"
	verdict deny "$n i vite"
	verdict deny "$p add foo"
	verdict deny "yarn upgrade"
	verdict deny "bun add foo"
	verdict deny "$n run build && $n install"

	# The opt-out, and its scope: it exempts the segment carrying it and nothing else.
	verdict allow "BORROWED_DEP_CHANGE=1 $n install"
	verdict deny "BORROWED_DEP_CHANGE=1 $n ci && $n install foo"
	verdict allow "$n ci && BORROWED_DEP_CHANGE=1 $n add foo"

	# Global options must not defeat the rail: `npm --prefix ./sub install` is a
	# hand-typed spelling, i.e. a mistake, which is precisely the threat model.
	verdict deny "$n --prefix ./sub install"
	verdict deny "$n --silent install"
	verdict deny "$n -g install foo"
	verdict deny "yarn --cwd x add foo"
	verdict deny "$p -C x add foo"
	verdict allow "$n --prefix ./sub ci"

	# False-positive classes that MUST stay allowed: an install command quoted inside
	# another command's argument, and prose naming one.
	verdict allow "$g log --grep='$n install'"
	verdict allow "$g commit -m 'explain why $n install is denied'"
	verdict allow "echo 'never run $n install here'"

	# Commands this rail must not judge at all — they belong to the shipped guard.
	verdict allow "$g push -u origin claude/thing"
	verdict allow "cat docs/STATE.md"

	reason_case() { # <command> <needle>
		local cmd="$1" needle="$2" out
		out=$( (check_command "$cmd") 2>&1 >/dev/null)
		case "$out" in
		*"$needle"*) printf 'ok    reason %s\n' "$needle" ;;
		*)
			printf 'FAIL  reason for [%s] should name [%s], said: %s\n' "$cmd" "$needle" "${out%%$'\n'*}"
			failures=$((failures + 1))
			;;
		esac
	}
	reason_case "$p add lodash" "\`$p add\`"
	reason_case "yarn upgrade" "\`yarn upgrade\`"
	reason_case "$n ${n:0:0}install" "supply-chain rail"

	# Entrypoint cases: exercise the dispatcher itself, so the exit-code contract and the
	# fail-open paths cannot regress green.
	e2e() { # <name> <expected-exit> <command...>
		local name="$1" expected="$2" got
		shift 2
		"$@" >/dev/null 2>&1
		got=$?
		if [ "$got" -eq "$expected" ]; then
			printf 'ok    e2e    %s\n' "$name"
		else
			printf 'FAIL  e2e    %s — exit %s, expected %s\n' "$name" "$got" "$expected"
			failures=$((failures + 1))
		fi
	}
	e2e "--command allows" 0 bash "$0" --command "$n ci"
	e2e "--command blocks" 2 bash "$0" --command "$n ${n:0:0}install"

	local e2e_empty e2e_bad e2e_hook
	printf '' | bash "$0" >/dev/null 2>&1
	e2e_empty=$?
	printf 'not json' | bash "$0" >/dev/null 2>&1
	e2e_bad=$?
	if [ "$e2e_empty" -eq 0 ] && [ "$e2e_bad" -eq 0 ]; then
		printf 'ok    e2e    fails open on empty and malformed input\n'
	else
		printf 'FAIL  e2e    fail-open broken — empty exit %s, malformed exit %s\n' "$e2e_empty" "$e2e_bad"
		failures=$((failures + 1))
	fi
	printf '{"tool_input":{"command":"%s %s"}}' "$n" "${n:0:0}install" | bash "$0" >/dev/null 2>&1
	e2e_hook=$?
	if [ "$e2e_hook" -eq 2 ]; then
		printf 'ok    e2e    hook-mode JSON blocks\n'
	else
		printf 'FAIL  e2e    hook-mode JSON — exit %s, expected 2\n' "$e2e_hook"
		failures=$((failures + 1))
	fi

	printf '\n'
	if [ "$failures" -ne 0 ]; then
		printf '%d rail case(s) FAILED\n' "$failures"
		return 1
	fi
	printf 'install-guard.sh self-test: ok\n'
}

main() {
	case "${1:-}" in
	--self-test)
		self_test
		exit $?
		;;
	--command)
		check_command "${2:-}"
		exit 0
		;;
	esac

	# Hook mode: a PreToolUse payload on stdin. Non-Bash tools and unparseable input are
	# allowed through untouched.
	local payload command
	payload=$(cat 2>/dev/null || true)
	[ -z "$payload" ] && exit 0
	command=$(printf '%s' "$payload" | node -e '
    let raw = "";
    process.stdin.on("data", (c) => { raw += c; });
    process.stdin.on("end", () => {
      try { process.stdout.write(String(JSON.parse(raw)?.tool_input?.command ?? "")); }
      catch { /* fail open */ }
    });
  ' 2>/dev/null || true)
	[ -z "$command" ] && exit 0
	check_command "$command"
	exit 0
}

main "$@"
