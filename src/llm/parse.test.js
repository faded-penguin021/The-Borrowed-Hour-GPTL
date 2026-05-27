import { describe, it, expect } from "vitest";
import {
  firstString,
  tryParseJSON,
  repairJSON,
  findBalancedJSONEnd,
  normalizeGameState,
  isStateEmpty,
  parseGMResponse,
  parseGMLogicResponse
} from "./parse.js";

describe("firstString", () => {
  it("returns first non-empty trimmed string", () => {
    expect(firstString(null, "", "  hello  ", "world")).toBe("hello");
  });
  it("returns empty string when no candidates qualify", () => {
    expect(firstString(null, undefined, "", "   ", 42)).toBe("");
  });
});

describe("tryParseJSON", () => {
  it("parses valid JSON", () => {
    expect(tryParseJSON('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null for malformed JSON", () => {
    expect(tryParseJSON("{not json")).toBe(null);
  });
});

describe("repairJSON", () => {
  it("strips trailing commas before closing brace and bracket", () => {
    const out = repairJSON('{"a":1,"b":[1,2,],}');
    expect(JSON.parse(out)).toEqual({ a: 1, b: [1, 2] });
  });
  it("converts smart quotes to ascii quotes", () => {
    const out = repairJSON('{“a”:“b”}');
    expect(JSON.parse(out)).toEqual({ a: "b" });
  });
  it("escapes raw newlines inside strings", () => {
    const out = repairJSON('{"a":"line1\nline2"}');
    expect(JSON.parse(out)).toEqual({ a: "line1\nline2" });
  });
  it("leaves newlines outside strings alone", () => {
    const out = repairJSON('{\n  "a": 1\n}');
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });
});

describe("findBalancedJSONEnd", () => {
  it("locates the matching closing brace", () => {
    const text = 'preamble {"a":{"b":2}} trailing';
    const start = text.indexOf("{");
    expect(findBalancedJSONEnd(text, start)).toBe(text.lastIndexOf("}"));
  });
  it("ignores braces inside strings", () => {
    const text = '{"a":"a}b"}';
    expect(findBalancedJSONEnd(text, 0)).toBe(text.length - 1);
  });
  it("returns -1 when unbalanced", () => {
    expect(findBalancedJSONEnd('{"a":1', 0)).toBe(-1);
  });
});

describe("normalizeGameState", () => {
  it("returns a fully-typed shape with safe defaults", () => {
    const out = normalizeGameState(null);
    expect(out).toEqual({
      scene: "", time: "", inventory: [], npcs: [],
      clues: [], summary: "", hidden_state: ""
    });
  });
  it("filters non-string inventory and clues", () => {
    const out = normalizeGameState({ inventory: ["sword", 42, null, "lantern"], clues: ["clue1", {}] });
    expect(out.inventory).toEqual(["sword", "lantern"]);
    expect(out.clues).toEqual(["clue1"]);
  });
  it("drops nameless NPCs and coerces their notes", () => {
    const out = normalizeGameState({
      npcs: [{ name: "Maret", note: "watching" }, { name: "" }, { note: "orphan" }, "string"]
    });
    expect(out.npcs).toEqual([{ name: "Maret", note: "watching" }]);
  });
});

describe("isStateEmpty", () => {
  it("treats null as empty", () => {
    expect(isStateEmpty(null)).toBe(true);
  });
  it("treats zero-content state as empty", () => {
    expect(isStateEmpty(normalizeGameState({}))).toBe(true);
  });
  it("treats any populated field as non-empty", () => {
    expect(isStateEmpty(normalizeGameState({ scene: "cloister" }))).toBe(false);
    expect(isStateEmpty(normalizeGameState({ inventory: ["x"] }))).toBe(false);
  });
});

describe("parseGMResponse", () => {
  it("parses clean JSON with narration", () => {
    const raw = JSON.stringify({ narration: "The bell tolls.", state: { scene: "tower" }, ending: null });
    const r = parseGMResponse(raw);
    expect(r.malformed).toBe(false);
    expect(r.narration).toBe("The bell tolls.");
    expect(r.state.scene).toBe("tower");
    expect(r.ending).toBe(null);
  });
  it("strips ```json fences", () => {
    const raw = '```json\n{"narration":"hi","state":{}}\n```';
    const r = parseGMResponse(raw);
    expect(r.malformed).toBe(false);
    expect(r.narration).toBe("hi");
  });
  it("recovers via repair pass when JSON has trailing commas", () => {
    const raw = '{"narration":"ok","state":{"inventory":["a",],},}';
    const r = parseGMResponse(raw);
    expect(r.malformed).toBe(false);
    expect(r.narration).toBe("ok");
    expect(r.state.inventory).toEqual(["a"]);
  });
  it("falls back to narrator_brief when narration is missing", () => {
    const raw = JSON.stringify({ narrator_brief: "brief text", state: {} });
    const r = parseGMResponse(raw);
    expect(r.narration).toBe("brief text");
  });
  it("flags missing narration as malformed with a diagnostic", () => {
    const raw = JSON.stringify({ state: {} });
    const r = parseGMResponse(raw);
    expect(r.malformed).toBe(true);
    expect(r.diagnostic).toMatch(/narration/i);
  });
  it("rejects unknown ending values", () => {
    const raw = JSON.stringify({ narration: "x", state: {}, ending: "transcendent" });
    const r = parseGMResponse(raw);
    expect(r.ending).toBe(null);
  });
  it("accepts a valid ending value", () => {
    const raw = JSON.stringify({ narration: "x", state: {}, ending: "bittersweet" });
    const r = parseGMResponse(raw);
    expect(r.ending).toBe("bittersweet");
  });
});

describe("parseGMLogicResponse", () => {
  it("requires both narrator_brief and state", () => {
    const r = parseGMLogicResponse(JSON.stringify({ narrator_brief: "x" }));
    expect(r.malformed).toBe(true);
  });
  it("parses a clean tool-style payload", () => {
    const raw = JSON.stringify({
      narrator_brief: "Tower at dusk.",
      state: { scene: "tower" },
      ending: "good"
    });
    const r = parseGMLogicResponse(raw);
    expect(r.malformed).toBe(false);
    expect(r.narrator_brief).toBe("Tower at dusk.");
    expect(r.ending).toBe("good");
  });
  it("preserves explicit-null ambience", () => {
    const raw = JSON.stringify({
      narrator_brief: "silence",
      state: {},
      ambience: null
    });
    const r = parseGMLogicResponse(raw);
    expect(r.ambience).toBe(null);
  });
});
