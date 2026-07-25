#!/usr/bin/env bash
# Fixture suite for the ladder's guards — guards are code, and a guard that
# silently stops firing is worse than none. Each case synthesizes a throwaway
# git repo containing scripts/ladder.sh plus the minimum docs, and asserts the
# guard's pass/warn/FAIL verdict.
#
# Never exercise a guard by mutating the real working tree: reverting with
# `git checkout --` destroys uncommitted work and no-ops on untracked files
# (D-007). Everything here happens in a temp directory.
#
#   scripts/test-ladder-guards.sh
set -uo pipefail

cd "$(dirname "$0")/.."
LADDER="$PWD/scripts/ladder.sh"
failures=0

# Build a throwaway repo whose origin/main baseline holds $1 bytes of STATE.md.
# Prints its path.
scaffold() {
  local baseline_bytes="${1:-100}" dir
  dir=$(mktemp -d)
  mkdir -p "$dir/scripts" "$dir/docs" "$dir/src"
  cp "$LADDER" "$dir/scripts/ladder.sh"
  cat > "$dir/docs/STATE.md" <<'HDR'
## Project
## Current state
## Owner queue
**Pending owner actions:**
## Decided non-items
HDR
  head -c "$baseline_bytes" /dev/zero | tr '\0' 'x' >> "$dir/docs/STATE.md"
  write_ledger "$dir" '- D-001: a row.'
  git -C "$dir" init -q
  git -C "$dir" add -A
  git -C "$dir" -c user.email=t@t -c user.name=t commit -qm base
  git -C "$dir" branch -q -f main
  git -C "$dir" remote add origin "$dir"
  git -C "$dir" update-ref refs/remotes/origin/main refs/heads/main
  printf '%s' "$dir"
}

# write_ledger <dir> <rows...> — every fixture must carry a D-005 row, because
# the script under test cites D-005 in its own landing-check diagnostic and
# scripts/ is inside the citation scan scope. That self-reference is real
# (the comment explains the rule the row records), so the fixtures model it
# rather than pretending it away.
write_ledger() {
  local dir="$1"; shift
  { printf '# LEDGER\n\n'
    printf '%s\n' "$@"
    printf -- '- D-005 [cited]: the landing-check rationale, cited by ladder.sh.\n'
  } > "$dir/docs/LEDGER.md"
}

# expect <name> <expected: pass|fail> <dir>
expect() {
  local name="$1" expected="$2" dir="$3" out status
  out=$( cd "$dir" && bash scripts/ladder.sh --guards-only 2>&1 ); status=$?
  local got=pass; [ "$status" -ne 0 ] && got=fail
  if [ "$got" = "$expected" ]; then
    echo "ok    ${name}"
  else
    echo "FAIL  ${name} — expected ${expected}, got ${got}"
    echo "      output: ${out}"
    failures=$(( failures + 1 ))
  fi
  rm -rf "$dir"
}

# ── STATE length ─────────────────────────────────────────────────────────
d=$(scaffold 100); expect "small STATE passes" pass "$d"

d=$(scaffold 100)
head -c $(( 17 * 1024 )) /dev/zero | tr '\0' 'x' >> "$d/docs/STATE.md"
expect "STATE over the hard cap fails" fail "$d"

# Landing check: baseline over the warn line, trim landing INSIDE the debounce
# band must fail; trim landing at or below the floor must pass. This is the case
# a HEAD-based lookback could never see, so it is the point of the whole suite.
d=$(scaffold $(( 15 * 1024 )))
head -c $(( 13 * 1024 )) /dev/zero | tr '\0' 'y' > "$d/docs/STATE.md.body"
cat "$d/docs/STATE.md.body" >> "$d/docs/STATE.md" && rm "$d/docs/STATE.md.body"
python3 - "$d" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1], "docs/STATE.md")
head = "## Project\n## Current state\n## Owner queue\n**Pending owner actions:**\n## Decided non-items\n"
p.write_text(head + "z" * (13 * 1024))
PY
expect "compression landing in the debounce band fails" fail "$d"

d=$(scaffold $(( 15 * 1024 )))
python3 - "$d" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1], "docs/STATE.md")
head = "## Project\n## Current state\n## Owner queue\n**Pending owner actions:**\n## Decided non-items\n"
p.write_text(head + "z" * 2048)
PY
expect "compression reaching the floor passes" pass "$d"

# ── STATE structure ──────────────────────────────────────────────────────
for section in "## Owner queue" "## Decided non-items"; do
  d=$(scaffold 100)
  grep -vF "$section" "$d/docs/STATE.md" > "$d/tmp" && mv "$d/tmp" "$d/docs/STATE.md"
  expect "dropping '${section}' fails" fail "$d"
done

# ── Ledger ───────────────────────────────────────────────────────────────
d=$(scaffold 100)
write_ledger "$d"
expect "ledger with no D-001-style rows does not abort the ladder" pass "$d"

d=$(scaffold 100)
write_ledger "$d" '- D-001: one.' '- D-001: two.'
expect "duplicate row numbers fail" fail "$d"

d=$(scaffold 100)
printf '// see D-404\n' > "$d/src/thing.ts"
expect "citation with no ledger row fails" fail "$d"

d=$(scaffold 100)
printf '// see D-001\n' > "$d/src/thing.ts"
expect "code citation without the [cited] marker fails" fail "$d"

d=$(scaffold 100)
printf '// see D-001\n' > "$d/src/thing.ts"
write_ledger "$d" '- D-001 [cited]: a row.'
expect "code citation with the marker passes" pass "$d"

d=$(scaffold 100)
write_ledger "$d" '- D-001 [cited]: a row.'
expect "marker with no code citation fails" fail "$d"

d=$(scaffold 100)
printf 'Prose citing D-404.\n' > "$d/docs/notes.md"
expect "dangling citation in docs fails" fail "$d"

d=$(scaffold 100)
printf 'Prose citing D-001.\n' > "$d/docs/notes.md"
expect "doc citation needs no [cited] marker" pass "$d"

echo
if [ "$failures" -ne 0 ]; then
  echo "${failures} guard case(s) FAILED"
  exit 1
fi
echo "all guard cases pass"
