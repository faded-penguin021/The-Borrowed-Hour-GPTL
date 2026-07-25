#!/usr/bin/env bash
# Agent-neutral pre-execution command guard. Makes this repo's hard rails
# deterministic instead of advisory, and — unlike a mute prefix-matched denial —
# blocks with a reason naming the rule and the correct alternative, so an agent
# self-corrects in one step instead of retrying variants.
#
# Rails enforced (all already binding in CLAUDE.md; this is the enforcement
# layer, not new policy):
#   1. package installs that resolve off the registry  (npm ci is the way)
#   2. force-push in any spelling
#   3. any push targeting main
#   4. environment / secret dumps
#
# Usage — three modes, so no agent's wiring is assumed:
#   scripts/command-guard.sh --command '<shell command>'   # neutral
#   scripts/command-guard.sh                               # PreToolUse JSON on stdin
#   scripts/command-guard.sh --self-test                   # blocked+allowed matrix
#
# Contract: exit 0 = allowed, exit 2 = blocked with the reason on stderr (the
# convention Claude Code surfaces back to the model). Any internal failure or
# malformed input exits 0 — a guard that bricks every command gets disabled
# rather than fixed, so it fails OPEN by construction.
#
# Threat model is agent MISTAKES, not evasion. Quoting and prefix tricks are
# accepted misses; the permission deny rails and the server-side branch
# protection layer beneath this one bind what this cannot.
set -uo pipefail

# Judge only the LEADING command of each simple-command segment, so text that
# merely CONTAINS a rail-tripping command — a commit message, a doc string, this
# script's own --self-test — never trips it. Known accepted false positive: a
# heredoc body whose line begins with a blocked command still reads as a segment.
segments() {
  # The trailing newline is load-bearing: without it `read` hits EOF on the last
  # (often only) segment and the caller's loop body never runs — a guard that
  # allows everything while reporting success.
  printf '%s\n' "$1" | tr '\n;&|()' '\n'
}

deny() {
  printf '%s\n' "$1" >&2
  exit 2
}

check_command() {
  local command="$1" segment stripped head_cmd arg1
  while IFS= read -r segment; do
    # Strip leading env-var assignments so `FOO=1 npm install` still resolves to
    # its real leading command.
    stripped=$(printf '%s' "$segment" | sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*//')
    # The LEADING command and its first argument decide the rule. Matching a
    # bare glob against the whole segment would fire on any text that merely
    # mentions a rail-tripping command — `git commit -m 'never force-push'`
    # reads as a git-push segment under `git*push*`.
    head_cmd=$(printf '%s' "$stripped" | awk '{print $1}')
    arg1=$(printf '%s' "$stripped" | awk '{print $2}')

    case "$head_cmd" in
      npm|pnpm|yarn|bun)
        # The opt-out is scoped to the segment that carries it, never the line.
        case "$segment" in *BORROWED_DEP_CHANGE=1*) continue ;; esac
        local mgr verb
        mgr="$head_cmd"
        verb="$arg1"
        case "$verb" in
          install|i|add|update|up|upgrade)
            deny "Blocked by this project's supply-chain rail: \`${mgr} ${verb}\` resolves versions off the registry and can pull a freshly compromised minor past the committed lockfile.

This is a deterministic project hook, not a one-off permission prompt — rephrasing, quoting, or re-running the same command will be blocked identically. Do not retry it.

Use instead:
  - \`npm ci\` — the normal path; installs the lockfile exactly. Not blocked.
  - \`BORROWED_DEP_CHANGE=1 ${mgr} ${verb} ...\` — only when the task's stated purpose IS a dependency change. The resulting package.json / package-lock.json diff is a reviewable event (CLAUDE.md → Supply-chain hygiene).

If a bump is failing CI rather than being one you meant to make, see docs/dependabot-triage.md — most shapes are fixed in source, not by installing."
            ;;
        esac
        ;;
      git)
        [ "$arg1" = "push" ] || continue
        case "$stripped" in
          *--force-with-lease*|*--force*|*" -f "*|*" -f")
            deny "Blocked: force-push is forbidden in this repo (CLAUDE.md → Git rules). Pushed checkpoints are immutable.

This is a deterministic project hook — retrying or respelling the flag will be blocked identically.

If the remote rejected your push, do NOT force it: fetch and merge the base branch into your session branch, resolve conflicts, and push normally. The single sanctioned exception is a leaked-credential history rewrite, which the OWNER executes, never an agent (CLAUDE.md → Secret hygiene)."
            ;;
        esac
        case "$stripped" in
          *" main"|*" main "*|*":main"|*":main "*|*" main:"*)
            deny "Blocked: pushing to \`main\` is forbidden (CLAUDE.md → Git rules). Develop on your session's claude/<codename> branch; the owner squash-merges it.

This is a deterministic project hook — retrying will be blocked identically.

Use: \`git push -u origin <your-session-branch>\`."
            ;;
        esac
        ;;
      env|printenv)
        deny "Blocked: environment dumps are forbidden (CLAUDE.md → Secret hygiene). This session's container carries real credentials (the VCS push token, the outbound-proxy auth), and a dump puts them in the context window permanently.

This is a deterministic project hook — retrying will be blocked identically.

Report fixed-key PRESENCE instead (\`[ -n \"\${PW_CHROMIUM:-}\" ] && echo set\`), never a value, prefix, suffix, length, or hash. If a diagnostic seems to need raw secret material, that is an Owner-queue open question asking for a narrower evidence contract — not a reason to dump."
        ;;
      cat|less|head|tail|bat)
        case "$stripped" in
          *" .env"|*" .env "*|*"/.env"|*"/.env "*|*" .env."*|*"/.env."*)
            deny "Blocked: reading .env-style files is forbidden (CLAUDE.md → Secret hygiene) — the same rail as environment dumps.

This is a deterministic project hook — retrying will be blocked identically.

Report fixed-key presence only. A diagnostic that seems to need the file's contents is an Owner-queue open question."
            ;;
        esac
        ;;
    esac
  done < <(segments "$command")
  return 0
}

# ── Self-test matrix (run as a ladder rung; a rail must not regress silently) ─
# Commands are assembled from fragments for two reasons: a shell line containing
# the literal blocked strings is itself blocked by the rail under test (D-003),
# and a scan of this file must not read its own fixtures as citations (D-008).
# Assert the deny REASON too, not just the verdict — that is how the earlier
# rail's mislabelled message got through (D-003).
self_test() {
  local failures=0 n="npm" g="git" p="pnpm"
  # verdict <expected: allow|deny> <command>
  verdict() {
    local expected="$1" cmd="$2" got=allow
    ( check_command "$cmd" ) 2>/dev/null || got=deny
    if [ "$got" = "$expected" ]; then
      printf 'ok    %-6s %s\n' "$got" "$cmd"
    else
      printf 'FAIL  %-6s %s (expected %s)\n' "$got" "$cmd" "$expected"
      failures=$(( failures + 1 ))
    fi
  }

  verdict allow "$n ci"
  verdict allow "$n ci && $n run build"
  verdict allow "$n run ladder"
  verdict allow "$n run ${n}-install-check"
  verdict allow "npx eslint ."
  verdict deny  "$n ${n:0:0}install"
  verdict deny  "$n i vite"
  verdict deny  "$p add foo"
  verdict deny  "yarn upgrade"
  verdict deny  "$n run build && $n install"
  verdict allow "BORROWED_DEP_CHANGE=1 $n install"
  verdict deny  "BORROWED_DEP_CHANGE=1 $n ci && $n install foo"
  verdict allow "$n ci && BORROWED_DEP_CHANGE=1 $n add foo"

  verdict allow "$g push -u origin claude/thing"
  verdict allow "$g status"
  verdict deny  "$g push --force"
  verdict deny  "$g push --force-with-lease origin claude/thing"
  verdict deny  "$g push -f origin claude/thing"
  verdict deny  "$g push origin main"
  verdict deny  "$g push origin HEAD:main"
  verdict deny  "$g push -u origin main"

  verdict deny  "env"
  verdict deny  "printenv PATH"
  verdict deny  "cat .env"
  verdict deny  "cat config/.env.local"
  verdict allow "cat docs/STATE.md"
  verdict allow "grep -c '' .github/workflows/ci.yml"

  # False-positive classes that MUST stay allowed: a rail-tripping command
  # quoted inside another command's argument, and prose naming a forbidden path.
  verdict allow "$g commit -m 'never $g push --force to main'"
  verdict allow "echo 'do not run env or cat .env here'"
  verdict allow "$g log --grep='$n install'"

  # The deny REASON is part of the contract: a rail whose message names the
  # wrong command teaches the agent the wrong correction (D-003).
  reason_case() {
    local cmd="$1" needle="$2" out
    out=$( ( check_command "$cmd" ) 2>&1 >/dev/null )
    case "$out" in
      *"$needle"*) printf 'ok    reason %s\n' "$needle" ;;
      *) printf 'FAIL  reason for [%s] should name [%s], said: %s\n' "$cmd" "$needle" "${out%%$'\n'*}"
         failures=$(( failures + 1 )) ;;
    esac
  }
  reason_case "$p add lodash" "\`$p add\`"
  reason_case "$g push --force" "force-push is forbidden"
  reason_case "$g push origin main" "pushing to \`main\` is forbidden"
  reason_case "env" "environment dumps are forbidden"
  reason_case "cat .env" ".env-style files"

  printf '\n'
  if [ "$failures" -ne 0 ]; then
    printf '%d rail case(s) FAILED\n' "$failures"
    return 1
  fi
  printf 'all rail cases pass\n'
}

main() {
  case "${1:-}" in
    --self-test) self_test; exit $? ;;
    --command)   check_command "${2:-}"; exit 0 ;;
  esac

  # Hook mode: a PreToolUse payload on stdin. Non-Bash tools and unparseable
  # input are allowed through untouched.
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
