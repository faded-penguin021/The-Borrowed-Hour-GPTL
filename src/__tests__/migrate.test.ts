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
