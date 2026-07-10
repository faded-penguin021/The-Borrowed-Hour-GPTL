#!/usr/bin/env node
// Supply-chain tripwires, enforced. This encodes CLAUDE.md's prose rules as a
// zero-dependency check that runs in the ladder and in CI:
//   1. Only an allowlisted set of packages may carry install scripts.
//   2. Known-compromised package families must not appear in the lockfile.
//   3. No .npmrc (this project has no private registry; a planted .npmrc can
//      redirect installs or exfiltrate tokens).
//   4. No AI-assistant config files nobody asked for (Miasma-style worms plant
//      persistent instructions in them).
//   5. No binding.gyp anywhere under node_modules (Miasma executes code via a
//      command-substitution `action` without any lifecycle script).
// Exit 0 = clean; exit 1 = a tripwire fired (details on stderr).

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const failures = [];

// ── 1+2: lockfile rules ──────────────────────────────────────────────
const INSTALL_SCRIPT_ALLOWLIST = new Set(["esbuild", "fsevents"]);
const BANNED_FAMILIES = [
  /^axios$/,
  /^@ctrl\/tinycolor$/,
  /^@duckdb\/node-/,
  /^@nativescript-community\//,
];

const lockPath = join(root, "package-lock.json");
if (!existsSync(lockPath)) {
  failures.push("package-lock.json is missing — the lockfile is the supply-chain anchor.");
} else {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path) continue; // the root project entry
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    if (meta.hasInstallScript && !INSTALL_SCRIPT_ALLOWLIST.has(name)) {
      failures.push(`lockfile: "${name}" gained hasInstallScript — not in the allowlist {${[...INSTALL_SCRIPT_ALLOWLIST].join(", ")}}.`);
    }
    for (const family of BANNED_FAMILIES) {
      if (family.test(name)) {
        failures.push(`lockfile: "${name}" matches a banned package family (${family}) — check current compromise advisories before allowing it.`);
      }
    }
  }
}

// ── 3+4: planted config files ────────────────────────────────────────
const FORBIDDEN_FILES = [
  ".npmrc",
  ".cursorrules",
  ".windsurfrules",
  ".continue",
  join(".github", "copilot-instructions.md"),
];
for (const f of FORBIDDEN_FILES) {
  if (existsSync(join(root, f))) failures.push(`forbidden file present: ${f}`);
}
for (const entry of readdirSync(root)) {
  if (entry.startsWith(".aider")) failures.push(`forbidden file present: ${entry}`);
}

// ── 5: binding.gyp under node_modules ────────────────────────────────
function findBindingGyp(dir, depth) {
  if (depth > 6) return [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const hits = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isFile() && e.name === "binding.gyp") hits.push(p);
    else if (e.isDirectory()) hits.push(...findBindingGyp(p, depth + 1));
  }
  return hits;
}
const nm = join(root, "node_modules");
if (existsSync(nm)) {
  for (const hit of findBindingGyp(nm, 0)) {
    failures.push(`binding.gyp found under node_modules: ${hit} (Miasma executes code through these without a lifecycle script).`);
  }
}

if (failures.length) {
  console.error("supply-chain guard FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("If a finding is intentional, it is a reviewable event: surface it to the user (see CLAUDE.md).");
  process.exit(1);
}
console.log("supply-chain guard: clean");
