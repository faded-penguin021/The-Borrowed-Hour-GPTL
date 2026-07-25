// Cases for the PreToolUse install rail: `node .claude/hooks/block-npm-install.test.mjs`.
//
// A plain shell loop can't test this — a command line containing the literal
// test strings is itself blocked by the rail under test — so the cases are
// assembled from fragments and fed to the hook as JSON payloads.
import { execFileSync } from "node:child_process";

const HOOK = new URL("./block-npm-install.mjs", import.meta.url).pathname;
const N = "npm", P = "pnpm", Y = "yarn", OPT = "BORROWED_DEP_CHANGE=1";

const cases = [
  [`${N} ci`, "allow"],
  [`${N} ${"install"}`, "deny"],
  [`${N} i vite`, "deny"],
  [`${N} ${"install"} --save-dev x`, "deny"],
  [`${OPT} ${N} ${"install"}`, "allow"],
  [`${OPT} ${N} ci && ${N} ${"install"} foo`, "deny"],
  [`${N} ci && ${OPT} ${N} add foo`, "allow"],
  [`${N} run build && ${N} ${"install"}`, "deny"],
  [`${P} add foo`, "deny"],
  [`${Y} upgrade`, "deny"],
  [`${N} run ladder`, "allow"],
  [`${N} ci && ${N} run build`, "allow"],
  [`${N} run ${"install"}-check`, "allow"],
  [`npx eslint .`, "allow"],
  [`git diff`, "allow"]
];

const run = (payload) =>
  execFileSync("node", [HOOK], { input: payload, encoding: "utf8" });

let failures = 0;
for (const [command, expected] of cases) {
  const out = run(JSON.stringify({ tool_input: { command } }));
  const got = out ? "deny" : "allow";
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${got.padEnd(5)} ${command}`);
}

const malformed = run("not json");
console.log(`${malformed ? "FAIL" : "ok  "}  fail-open on malformed payload`);
if (malformed) failures++;

// The deny reason must name the actual manager and verb, not a shifted capture.
const reason = JSON.parse(run(JSON.stringify({
  tool_input: { command: `${P} add lodash` }
}))).hookSpecificOutput.permissionDecisionReason;
const named = reason.includes(`\`${P} add\``);
console.log(`${named ? "ok  " : "FAIL"}  deny reason names the command`);
if (!named) failures++;

console.log(failures ? `${failures} FAILURES` : "all cases pass");
process.exit(failures ? 1 : 0);
