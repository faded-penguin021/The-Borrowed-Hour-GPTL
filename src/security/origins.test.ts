// Locks the CSP connect-src allowlist in index.html to the declared origin
// manifest, in both directions: an origin added to code without a CSP entry
// fails here (it would be silently blocked in production), and a CSP entry
// nobody declares fails too (it would be an unexplained hole in the policy).
import { describe, it, expect } from "vitest";
import html from "../../index.html?raw";
import { CONNECT_SRC_ORIGINS } from "./origins";

function connectSrcFromIndexHtml(): string[] {
  const meta = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if (!meta) throw new Error("CSP meta tag not found in index.html");
  const directive = meta[1]
    .split(";")
    .map((d: string) => d.trim())
    .find((d: string) => d.startsWith("connect-src "));
  if (!directive) throw new Error("connect-src directive not found in CSP");
  return directive.slice("connect-src ".length).split(/\s+/).filter(Boolean);
}

describe("CSP connect-src ↔ origin manifest", () => {
  it("every declared origin is in the CSP, and vice versa", () => {
    const csp = new Set(connectSrcFromIndexHtml());
    const manifest = new Set(CONNECT_SRC_ORIGINS);
    const missingFromCsp = [...manifest].filter((o) => !csp.has(o));
    const undeclaredInCsp = [...csp].filter((o) => !manifest.has(o));
    expect(missingFromCsp, "origins declared in src/security/origins.ts but absent from index.html connect-src").toEqual([]);
    expect(undeclaredInCsp, "connect-src entries nobody declared in src/security/origins.ts").toEqual([]);
  });

  it("manifest has no duplicates", () => {
    expect(new Set(CONNECT_SRC_ORIGINS).size).toBe(CONNECT_SRC_ORIGINS.length);
  });
});
