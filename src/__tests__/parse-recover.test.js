import { describe, it, expect } from "vitest";
import {
  tryParseJSON, extractJSONBlock,
  parseGMResponse, parseGMLogicResponse, isStateEmpty
} from "../llm/parse.js";
import { GameStateSchema, GMLogicResponseSchema } from "../llm/schemas.js";

describe("tryParseJSON", () => {
  it("returns parsed object for valid JSON", () => {
    expect(tryParseJSON('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null for garbage", () => {
    expect(tryParseJSON("nope")).toBeNull();
    expect(tryParseJSON("")).toBeNull();
  });
});

describe("extractJSONBlock", () => {
  it("parses clean JSON directly", () => {
    expect(extractJSONBlock('{"narration":"hello","state":{}}'))
      .toEqual({ narration: "hello", state: {} });
  });

  it("strips markdown fences", () => {
    expect(extractJSONBlock('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts JSON embedded in prose", () => {
    expect(extractJSONBlock('Here is the response:\n{"key":"value"}\nEnd.'))
      .toEqual({ key: "value" });
  });

  it("drops a stray trailing brace after a balanced object", () => {
    expect(extractJSONBlock('{"a":{"b":1}}}')).toEqual({ a: { b: 1 } });
  });

  it("handles trailing garbage via last-brace fallback", () => {
    expect(extractJSONBlock('{"a":"hello"} extra } text'))
      .toEqual({ a: "hello" });
  });

  it("repairs trailing commas (bare and fenced)", () => {
    expect(extractJSONBlock('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
    expect(extractJSONBlock('```json\n{"a":1,}\n```')).toEqual({ a: 1 });
  });

  it("repairs smart quotes", () => {
    expect(extractJSONBlock('{“key”: “value”}')).toEqual({ key: "value" });
  });

  it("escapes raw newlines inside strings (bare and fenced)", () => {
    expect(extractJSONBlock('{"text":"line1\nline2"}')).toEqual({ text: "line1\nline2" });
    expect(extractJSONBlock('```json\n{"text":"a\nb"}\n```')).toEqual({ text: "a\nb" });
  });

  it("returns null for input with no JSON", () => {
    expect(extractJSONBlock("just some random text with no JSON at all")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractJSONBlock("")).toBeNull();
  });
});

describe("GameStateSchema", () => {
  it("defaults missing arrays to empty", () => {
    const state = GameStateSchema.parse({ scene: "room", time: "noon" });
    expect(state.inventory).toEqual([]);
    expect(state.npcs).toEqual([]);
    expect(state.clues).toEqual([]);
    expect(state.summary).toBe("");
    expect(state.hidden_state).toBe("");
  });

  it("parses a complete state", () => {
    const state = GameStateSchema.parse({
      scene: "A dark room", time: "midnight",
      inventory: ["key", "torch"], npcs: [{ name: "Elias", note: "guard" }],
      clues: ["footprints"], summary: "ongoing", hidden_state: "secret"
    });
    expect(state.scene).toBe("A dark room");
    expect(state.npcs).toHaveLength(1);
    expect(state.npcs[0].name).toBe("Elias");
  });

  it("rejects a non-string inventory item", () => {
    expect(GameStateSchema.safeParse({ inventory: ["torch", 42] }).success).toBe(false);
  });
});

describe("GMLogicResponseSchema", () => {
  it("requires a non-empty narrator_brief", () => {
    expect(GMLogicResponseSchema.safeParse({ narrator_brief: "", state: {} }).success).toBe(false);
  });
  it("coerces an unknown ending to null", () => {
    const r = GMLogicResponseSchema.safeParse({ narrator_brief: "b", state: {}, ending: "weird" });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error("unreachable");
    expect(r.data.ending).toBeNull();
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
    expect(result.state).not.toBeNull();
    if (!result.state) throw new Error("unreachable");
    expect(result.state.scene).toBe("hallway");
    expect(result.state.inventory).toEqual([]);
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
    expect(result.state).not.toBeNull();
    if (!result.state) throw new Error("unreachable");
    expect(result.state.npcs).toEqual([]);
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

describe("isStateEmpty", () => {
  it("treats null and a blank state as empty", () => {
    expect(isStateEmpty(null)).toBe(true);
    expect(isStateEmpty(GameStateSchema.parse({}))).toBe(true);
  });
  it("treats a populated state as non-empty", () => {
    expect(isStateEmpty(GameStateSchema.parse({ scene: "room" }))).toBe(false);
  });
});
