import { describe, it, expect } from "vitest";
import { migrateSave, CURRENT_SAVE_VERSION } from "../saves/migrate";

describe("migrateSave", () => {
  it("stamps schemaVersion on a pre-versioning save", () => {
    const old = { id: "abc", premiseId: "p1", savedAt: 123 };
    const result = migrateSave(old);
    expect(result.schemaVersion).toBe(1);
  });

  it("preserves schemaVersion on an already-versioned save", () => {
    const v1 = { id: "abc", schemaVersion: 1 };
    const result = migrateSave(v1);
    expect(result.schemaVersion).toBe(1);
  });

  it("handles null/undefined gracefully", () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave(undefined)).toBeUndefined();
  });

  it("exports the current version as 1", () => {
    expect(CURRENT_SAVE_VERSION).toBe(1);
  });
});

describe("migrateSave normalization (damaged records degrade, never crash)", () => {
  it("passes a well-formed record through intact", () => {
    const good = {
      id: "abc", schemaVersion: 1, premiseId: "p1", savedAt: 5,
      premise: { id: "p1", title: "The Hour" },
      entries: [{ type: "narration", text: "hello", illustration: { status: "ready", url: "idb:k" } }],
      history: [{ role: "user", content: "Begin." }],
      metaMessages: [{ role: "assistant", text: "hi" }],
      gameState: { scene: "a room", inventory: ["key"] },
    };
    const r = migrateSave(good);
    expect(r.premise?.title).toBe("The Hour");
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].illustration?.url).toBe("idb:k");
    expect(r.history).toHaveLength(1);
    expect(r.metaMessages).toHaveLength(1);
    expect(r.gameState?.scene).toBe("a room");
    expect(r.gameState?.inventory).toEqual(["key"]);
  });

  it("drops malformed collection members and coerces non-arrays", () => {
    const bad = {
      id: "abc",
      entries: [42, { type: "narration" }, { type: "action", text: "ok" }, "junk"],
      history: "not-an-array",
      metaMessages: [{ role: "user" }, { role: "user", text: "kept" }],
    };
    const r = migrateSave(bad);
    expect(r.entries).toEqual([{ type: "action", text: "ok" }]);
    expect(r.history).toEqual([]);
    expect(r.metaMessages).toEqual([{ role: "user", text: "kept" }]);
  });

  it("nulls a gameState that fails the schema and clamps one that passes", () => {
    expect(migrateSave({ gameState: { inventory: [42] } }).gameState).toBeNull();
    expect(migrateSave({ gameState: "garbage" }).gameState).toBeNull();
    const clamped = migrateSave({ gameState: { summary: "x".repeat(50_000) } });
    expect(clamped.gameState?.summary.length).toBe(20_000);
  });

  it("drops a premise missing id/title and a non-object illustration", () => {
    const r = migrateSave({
      premise: { title: 42 },
      entries: [{ type: "narration", text: "n", illustration: "not-an-object" }],
    });
    expect(r.premise).toBeUndefined();
    expect(r.entries[0].illustration).toBeUndefined();
  });
});
