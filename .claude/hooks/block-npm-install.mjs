#!/usr/bin/env node
// PreToolUse(Bash) rail: make CLAUDE.md's "npm ci, never npm install" rule
// deterministic instead of advisory. Sanctioned by the owner, 2026-07-25.
//
// Blocks package-manager commands that can resolve fresh versions off the
// registry (npm/pnpm/yarn/bun install|i|add|update|upgrade) and so can pull a
// freshly compromised minor past the committed lockfile. `npm ci` is untouched.
//
// Deliberate escape hatch for the one legitimate case — a task whose *purpose*
// is a dependency change: prefix the command with BORROWED_DEP_CHANGE=1. That
// keeps intent explicit and auditable in the transcript rather than silent.
//
// Contract: read the PreToolUse payload on stdin, emit a permission decision on
// stdout. Any internal failure exits 0 without a decision (fail-open) so a bug
// here can never wedge a session.

// Segment-wise, so the opt-out stays narrow: it exempts the one command it
// prefixes, not every command sharing the line. `BORROWED_DEP_CHANGE=1 npm ci
// && npm add foo` still blocks on the second half.
const SEGMENT = /\n|;|&&|\|\||[|&()]/;
const INSTALLISH = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(npm|pnpm|yarn|bun)\s+(install|i|add|update|up|upgrade)(\s|$)/;
const OPT_OUT = /^\s*BORROWED_DEP_CHANGE=1\s/;

const reason = (manager, verb) => [
  `Blocked by this project's supply-chain rail: \`${manager} ${verb}\` resolves versions off the registry and can pull a freshly compromised minor past the committed lockfile.`,
  "",
  "This is a deterministic project hook, not a one-off permission prompt — rephrasing, quoting, or re-running the same command will be blocked identically. Do not retry it.",
  "",
  "Use instead:",
  "  - `npm ci` — the normal path; installs the lockfile exactly. Not blocked.",
  "  - `BORROWED_DEP_CHANGE=1 " + manager + " " + verb + " ...` — only when the task's stated purpose IS a dependency change. The resulting package.json / package-lock.json diff is a reviewable event (CLAUDE.md → Supply-chain hygiene).",
  "",
  "If a bump is failing CI rather than being one you meant to make, see docs/dependabot-triage.md — most shapes are fixed in source, not by installing."
].join("\n");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const command = JSON.parse(raw)?.tool_input?.command;
    if (typeof command !== "string") process.exit(0);
    let hit = null;
    for (const segment of command.split(SEGMENT)) {
      if (OPT_OUT.test(segment)) continue;
      hit = INSTALLISH.exec(segment);
      if (hit) break;
    }
    if (!hit) process.exit(0);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason(hit[1], hit[2])
      }
    }));
  } catch {
    // Fail open: a malformed payload must not block the session.
  }
  process.exit(0);
});
