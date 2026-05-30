import { describe, it, expect } from "vitest";
import {
  recoverJSON, repairJSON, tryParseJSON,
  findBalancedJSONEnd, normalizeGameState, parseGMResponse, parseGMLogicResponse
} from "../llm/parse.js";

describe("tryParseJSON", () => {
  it("returns parsed object for valid JSON", () => {
    expect(tryParseJSON('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null for garbage", () => {
    expect(tryParseJSON("nope")).toBeNull();
    expect(tryParseJSON("")).toBeNull();
  });
});

describe("repairJSON", () => {
  it("strips trailing commas", () => {
    expect(JSON.parse(repairJSON('{"a":1,}'))).toEqual({ a: 1 });
    expect(JSON.parse(repairJSON('[1,2,]'))).toEqual([1, 2]);
  });
  it("normalizes smart quotes", () => {
    const input = '{“key”: “value”}';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: "value" });
  });
  it("escapes raw newlines inside strings", () => {
    const input = '{"text":"line1\nline2"}';
    const result = repairJSON(input);
    expect(JSON.parse(result)).toEqual({ text: "line1\nline2" });
  });
  it("leaves valid JSON unchanged (structurally)", () => {
    const valid = '{"a":"b","c":[1,2]}';
    expect(JSON.parse(repairJSON(valid))).toEqual(JSON.parse(valid));
  });
});

describe("findBalancedJSONEnd", () => {
  it("finds the closing brace of a simple object", () => {
    const text = '{"a":1}';
    expect(findBalancedJSONEnd(text, 0)).toBe(6);
  });
  it("handles nested objects", () => {
    const text = '{"a":{"b":2}}';
    expect(findBalancedJSONEnd(text, 0)).toBe(12);
  });
  it("ignores braces inside strings", () => {
    const text = '{"a":"{}"}';
    expect(findBalancedJSONEnd(text, 0)).toBe(9);
  });
  it("returns -1 for unterminated object", () => {
    expect(findBalancedJSONEnd('{"a":1', 0)).toBe(-1);
  });
});

describe("recoverJSON", () => {
  it("parses clean JSON directly", () => {
    const { parsed, repaired } = recoverJSON('{"narration":"hello","state":{}}');
    expect(parsed).toEqual({ narration: "hello", state: {} });
    expect(repaired).toBe(false);
  });

  it("strips markdown fences", () => {
    const { parsed } = recoverJSON('```json\n{"a":1}\n```');
    expect(parsed).toEqual({ a: 1 });
  });

  it("extracts JSON embedded in prose", () => {
    const { parsed } = recoverJSON('Here is the response:\n{"key":"value"}\nEnd.');
    expect(parsed).toEqual({ key: "value" });
  });

  it("recovers via repair pass (trailing comma)", () => {
    const { parsed, repaired } = recoverJSON('Some text {"a":1, "b":2,}');
    expect(parsed).toEqual({ a: 1, b: 2 });
    expect(repaired).toBe(true);
  });

  it("returns null for truly broken input", () => {
    const { parsed } = recoverJSON("just some random text with no JSON at all");
    expect(parsed).toBeNull();
  });

  it("returns null for empty input", () => {
    const { parsed } = recoverJSON("");
    expect(parsed).toBeNull();
  });

  it("handles truncated JSON via last-brace fallback", () => {
    const { parsed } = recoverJSON('{"a":"hello"} extra garbage } more');
    expect(parsed).toEqual({ a: "hello" });
  });
});

describe("normalizeGameState", () => {
  it("normalizes a complete state", () => {
    const state = normalizeGameState({
      scene: "A dark room", time: "midnight",
      inventory: ["key", "torch"], npcs: [{ name: "Elias", note: "guard" }],
      clues: ["footprints"], summary: "ongoing", hidden_state: "secret"
    });
    expect(state.scene).toBe("A dark room");
    expect(state.npcs).toHaveLength(1);
    expect(state.npcs[0].name).toBe("Elias");
  });

  it("handles null/undefined gracefully", () => {
    const state = normalizeGameState(null);
    expect(state.scene).toBe("");
    expect(state.inventory).toEqual([]);
    expect(state.npcs).toEqual([]);
  });

  it("filters non-string inventory items", () => {
    const state = normalizeGameState({ inventory: ["torch", 42, null, "key"] });
    expect(state.inventory).toEqual(["torch", "key"]);
  });

  it("filters NPCs without names", () => {
    const state = normalizeGameState({ npcs: [{ name: "Ada", note: "x" }, { note: "no name" }] });
    expect(state.npcs).toHaveLength(1);
  });
});

describe("parseGMResponse", () => {
  it("parses a well-formed GM response", () => {
    const raw = JSON.stringify({
      narration: "The door creaks open.",
      state: { scene: "hallway", time: "dusk" },
    });
    const result = parseGMResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narration).toBe("The door creaks open.");
    expect(result.state.scene).toBe("hallway");
  });

  it("marks missing narration as malformed", () => {
    const raw = JSON.stringify({ state: { scene: "x" } });
    const result = parseGMResponse(raw);
    expect(result.malformed).toBe(true);
    expect(result.diagnostic).toContain("narration");
  });

  it("recovers from markdown-fenced response", () => {
    const raw = '```json\n' + JSON.stringify({
      narration: "Hello", state: { scene: "room" }
    }) + '\n```';
    const result = parseGMResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narration).toBe("Hello");
  });
});

describe("parseGMLogicResponse", () => {
  it("parses a well-formed GM logic response", () => {
    const raw = JSON.stringify({
      narrator_brief: "The guard steps forward.",
      state: { scene: "gate", time: "noon" },
    });
    const result = parseGMLogicResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narrator_brief).toBe("The guard steps forward.");
  });

  it("tries alternate field names for narrator_brief", () => {
    const raw = JSON.stringify({
      narration: "Fallback text",
      state: { scene: "x" },
    });
    const result = parseGMLogicResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narrator_brief).toBe("Fallback text");
  });

  it("marks missing state as malformed", () => {
    const raw = JSON.stringify({ narrator_brief: "text" });
    const result = parseGMLogicResponse(raw);
    expect(result.malformed).toBe(true);
    expect(result.diagnostic).toContain("state");
  });
});
