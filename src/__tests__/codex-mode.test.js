/**
 * @import { CodexMode } from "../types"
 */
import { describe, it, expect } from "vitest";
import useCodexSource from "../hooks/useCodex.ts?raw";
import { CODEX_MODE_OPTIONS, DEFAULT_CODEX_SETTINGS } from "../data/constants";

// Regression coverage for the "codex mode ghost" bug: the `CodexMode` type once
// declared "milestone"/"every" while the settings UI, the persisted defaults,
// and the useCodex runtime all spoke "key_moments"/"always". A `@type` cast in
// CodexSection laundered the wrong literal through, so static typing never caught
// the divergence and no test exercised the wiring. These tests lock the three
// surfaces — UI options, persisted default, and runtime comparisons — together.

// The canonical persisted vocabulary. The settings UI may only emit these, and
// the runtime may only branch on these.
const CANONICAL_MODES = ["off", "key_moments", "always"];

describe("codex mode vocabulary", () => {
  it("exposes exactly the canonical modes, in order", () => {
    expect(CODEX_MODE_OPTIONS.map((o) => o.id)).toEqual(CANONICAL_MODES);
  });

  it("gives every option a label and a hint for the radiogroup", () => {
    for (const opt of CODEX_MODE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.hint.length).toBeGreaterThan(0);
    }
  });

  it("ships a default mode that is a real, selectable option", () => {
    expect(CANONICAL_MODES).toContain(DEFAULT_CODEX_SETTINGS.mode);
  });
});

describe("codex mode runtime wiring", () => {
  // Read the runtime source and extract every `codex.mode === "x"` / `!== "x"`
  // comparison. Each literal the runtime gates on MUST be a value the UI can
  // actually produce — otherwise a mode is functionally unreachable (the exact
  // failure mode of the original bug).
  const comparedLiterals = [
    ...useCodexSource.matchAll(/codex\.mode\s*(?:===|!==)\s*"([^"]+)"/g),
  ].map((m) => m[1]);

  it("compares against at least one mode literal (sanity)", () => {
    expect(comparedLiterals.length).toBeGreaterThan(0);
  });

  it("only branches on modes the settings UI can emit", () => {
    const selectable = new Set(CODEX_MODE_OPTIONS.map((o) => o.id));
    for (const literal of comparedLiterals) {
      expect(selectable).toContain(literal);
    }
  });

  it("special-cases the disable ('off') and every-turn ('always') modes", () => {
    // These are the two tokens the runtime treats specially; "key_moments" is the
    // implicit gated default (the else branch). Guard that both remain wired.
    expect(comparedLiterals).toContain("off");
    expect(comparedLiterals).toContain("always");
  });
});
