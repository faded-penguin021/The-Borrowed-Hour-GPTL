import { describe, it, expect, vi } from "vitest";
import {
  tryParseJSON, extractJSONBlock,
  parseGMResponse, parseGMLogicResponse, isStateEmpty
} from "../llm/parse";
import { GameStateSchema, GMLogicResponseSchema } from "../llm/schemas";
import { toPlayerLedger } from "../llm/prompt";

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
  it("normalizes case and whitespace on a valid ending", () => {
    for (const raw of ["BAD", "Bad", " bad ", "BITTERSWEET"]) {
      const r = GMLogicResponseSchema.safeParse({ narrator_brief: "b", state: {}, ending: raw });
      expect(r.success).toBe(true);
      if (!r.success) throw new Error("unreachable");
      expect(r.data.ending).toBe(raw.trim().toLowerCase());
    }
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
    // parseGMResponse warns on malformed input by design; silence the expected
    // console.warn so the suite's stderr stays clean.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = JSON.stringify({ state: { scene: "x" } });
    const result = parseGMResponse(raw);
    expect(result.malformed).toBe(true);
    expect(result.diagnostic).toContain("narration");
    warn.mockRestore();
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

describe("ledger / hidden_state structural split", () => {
  it("flattens the nested ledger sub-object into flat state", () => {
    const state = GameStateSchema.parse({
      ledger: {
        scene: "a platform",
        time: "8:11",
        inventory: ["a ticket"],
        npcs: [{ name: "the woman", note: "seems wary" }],
        clues: ["a copper ring was mentioned"],
        summary: "The player boarded the train."
      },
      hidden_state: "Assassin arrives Night 2."
    });
    expect(state.scene).toBe("a platform");
    expect(state.clues).toEqual(["a copper ring was mentioned"]);
    expect(state.hidden_state).toBe("Assassin arrives Night 2.");
  });

  it("still accepts a legacy flat state object", () => {
    const state = GameStateSchema.parse({
      scene: "a platform",
      summary: "boarded",
      hidden_state: "secret"
    });
    expect(state.scene).toBe("a platform");
    expect(state.hidden_state).toBe("secret");
  });

  it("parses a full GM logic response with the nested ledger", () => {
    const raw = JSON.stringify({
      narrator_brief: "Render the woman noticing the ticket.",
      state: {
        ledger: { scene: "a platform", summary: "boarded" },
        hidden_state: "secret allegiance"
      }
    });
    const result = parseGMLogicResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.state?.scene).toBe("a platform");
    expect(result.state?.hidden_state).toBe("secret allegiance");
  });

  it("projects to a PlayerLedger that cannot carry hidden_state", () => {
    const state = GameStateSchema.parse({
      ledger: { scene: "a platform", summary: "boarded" },
      hidden_state: "the woman is the assassin"
    });
    const ledger = toPlayerLedger(state);
    expect(ledger.scene).toBe("a platform");
    expect(Object.keys(ledger)).not.toContain("hidden_state");
    expect(JSON.stringify(ledger)).not.toContain("assassin");
  });
});

describe("array-wrapped payload recovery", () => {
  it("unwraps a one-element array around the GM object", () => {
    const raw = JSON.stringify([{ narration: "Hello", state: { scene: "room" } }]);
    const result = parseGMResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narration).toBe("Hello");
    expect(result.state?.scene).toBe("room");
  });

  it("unwraps a fenced array-wrapped GM logic object", () => {
    const raw = "```json\n" + JSON.stringify([{ narrator_brief: "b", state: {} }]) + "\n```";
    const result = parseGMLogicResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narrator_brief).toBe("b");
  });

  it("skips non-object leading elements", () => {
    expect(extractJSONBlock('["noise", {"a":1}]')).toEqual({ a: 1 });
  });

  it("treats an array with no object element as malformed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseGMResponse("[1, 2, 3]");
    expect(result.malformed).toBe(true);
    warn.mockRestore();
  });
});

describe("anti-runaway size clamps", () => {
  it("truncates oversized prose fields instead of failing the parse", () => {
    const raw = JSON.stringify({
      narrator_brief: "b".repeat(30_000),
      state: {
        ledger: { scene: "s".repeat(5_000), summary: "x".repeat(50_000) },
        hidden_state: "h".repeat(50_000),
      },
    });
    const result = parseGMLogicResponse(raw);
    expect(result.malformed).toBe(false);
    expect(result.narrator_brief.length).toBe(20_000);
    expect(result.state?.scene.length).toBe(1_000);
    expect(result.state?.summary.length).toBe(20_000);
    expect(result.state?.hidden_state.length).toBe(20_000);
  });

  it("caps list lengths and entry sizes", () => {
    const state = GameStateSchema.parse({
      inventory: Array.from({ length: 500 }, (_, i) => `item ${i} ${"y".repeat(2_000)}`),
      npcs: Array.from({ length: 500 }, (_, i) => ({ name: `npc ${i}`, note: "n".repeat(5_000) })),
      clues: Array.from({ length: 500 }, (_, i) => `clue ${i}`),
    });
    expect(state.inventory.length).toBe(50);
    expect(state.inventory[0].length).toBe(1_000);
    expect(state.npcs.length).toBe(50);
    expect(state.npcs[0].note.length).toBe(1_000);
    expect(state.clues.length).toBe(50);
  });

  it("leaves normal-sized fields untouched", () => {
    const state = GameStateSchema.parse({
      scene: "A lamplit corridor",
      inventory: ["a folded letter"],
      summary: "You arrived at the appointed hour.",
    });
    expect(state.scene).toBe("A lamplit corridor");
    expect(state.inventory).toEqual(["a folded letter"]);
    expect(state.summary).toBe("You arrived at the appointed hour.");
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
