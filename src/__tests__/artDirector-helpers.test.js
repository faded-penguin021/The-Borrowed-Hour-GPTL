import { describe, it, expect } from "vitest";
import {
  mergeLedger, composeImagePrompt,
  parseBootstrapResponse, parseTurnResponse
} from "../llm/artDirector.js";

describe("mergeLedger", () => {
  it("adds new entries", () => {
    const current = [{ id: "npc:elias", tags: ["tall", "scarred"] }];
    const updates = [{ id: "location:gate", tags: ["iron", "moss"] }];
    const result = mergeLedger(current, updates);
    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === "location:gate").tags).toEqual(["iron", "moss"]);
  });

  it("updates existing entries by id", () => {
    const current = [{ id: "npc:elias", tags: ["tall"] }];
    const updates = [{ id: "npc:elias", tags: ["tall", "scarred", "cloaked"] }];
    const result = mergeLedger(current, updates);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual(["tall", "scarred", "cloaked"]);
  });

  it("filters non-string tags", () => {
    // Deliberately malformed tags to exercise the string-only filter.
    const result = mergeLedger([], /** @type {VisualLedgerEntry[]} */ ([{ id: "npc:x", tags: ["ok", 42, null, "fine"] }]));
    expect(result[0].tags).toEqual(["ok", "fine"]);
  });

  it("skips invalid updates (no id, no tags array)", () => {
    const current = [{ id: "a", tags: ["x"] }];
    // Deliberately invalid entries (null, missing id, missing tags) to exercise the skip path.
    const result = mergeLedger(current, /** @type {VisualLedgerEntry[]} */ ([null, { tags: ["y"] }, { id: "b" }]));
    expect(result).toHaveLength(1);
  });

  it("returns current when updates is empty", () => {
    const current = [{ id: "a", tags: ["x"] }];
    expect(mergeLedger(current, [])).toBe(current);
  });
});

describe("composeImagePrompt", () => {
  const styleBible = {
    era: "19th-century etching",
    medium: "ink wash",
    palette: ["sepia", "bone"],
    composition: "centered tableau",
    negatives: ["modern", "neon"]
  };
  const ledger = [
    { id: "npc:elias", tags: ["tall", "scarred"] },
    { id: "location:chamber", tags: ["stone", "candlelit"] }
  ];

  it("composes a prompt with style, subjects, and scene", () => {
    const result = composeImagePrompt({
      styleBible, visualLedger: ledger,
      subjectIds: ["npc:elias"],
      sceneClause: "A figure stands at the threshold"
    });
    expect(result.prompt).toContain("19th-century etching");
    expect(result.prompt).toContain("elias: tall, scarred");
    expect(result.prompt).toContain("A figure stands at the threshold");
  });

  it("deduplicates negatives from bible and extras", () => {
    const result = composeImagePrompt({
      styleBible, visualLedger: ledger,
      extraNegatives: ["neon", "text"]
    });
    const neonCount = result.negatives.filter((n) => n === "neon").length;
    expect(neonCount).toBe(1);
    expect(result.negatives).toContain("text");
  });

  it("handles missing subjects gracefully", () => {
    const result = composeImagePrompt({
      styleBible, visualLedger: ledger,
      subjectIds: ["npc:unknown"]
    });
    expect(result.prompt).not.toContain("unknown");
  });
});

describe("parseBootstrapResponse", () => {
  it("parses a valid bootstrap response", () => {
    const raw = JSON.stringify({
      style_bible: { era: "x", medium: "y", palette: ["a"], composition: "c", negatives: ["n"] },
      visual_ledger: [{ id: "self:protagonist", tags: ["young"] }]
    });
    const result = parseBootstrapResponse(raw);
    expect(result.malformed).toBeUndefined();
    expect(result.style_bible.era).toBe("x");
    expect(result.visual_ledger).toHaveLength(1);
  });

  it("marks empty input as malformed", () => {
    expect(parseBootstrapResponse("").malformed).toBe(true);
    expect(parseBootstrapResponse(null).malformed).toBe(true);
  });

  it("marks response without style_bible as malformed", () => {
    const raw = JSON.stringify({ visual_ledger: [] });
    expect(parseBootstrapResponse(raw).malformed).toBe(true);
  });
});

describe("parseTurnResponse", () => {
  it("parses a valid turn response", () => {
    const raw = JSON.stringify({
      warrants_illustration: true,
      milestone_reason: "first reveal",
      caption: "The gate",
      scene_clause: "a tall iron gate under moonlight",
      subject_ids: ["location:gate"],
      extra_negatives: [],
      ledger_updates: []
    });
    const result = parseTurnResponse(raw);
    expect(result.malformed).toBeUndefined();
    expect(result.warrants_illustration).toBe(true);
    expect(result.caption).toBe("The gate");
  });

  it("defaults missing optional fields", () => {
    const raw = JSON.stringify({
      warrants_illustration: false,
      milestone_reason: "routine"
    });
    const result = parseTurnResponse(raw);
    expect(result.caption).toBe("");
    expect(result.subject_ids).toEqual([]);
    expect(result.ledger_updates).toEqual([]);
  });

  it("marks empty input as malformed", () => {
    expect(parseTurnResponse("").malformed).toBe(true);
  });
});
