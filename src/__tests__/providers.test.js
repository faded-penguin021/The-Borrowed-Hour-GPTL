/**
 * @import { ProviderId } from "../types"
 */
import { describe, it, expect } from "vitest";
import { PROVIDER_META, PROVIDER_ORDER } from "../llm/providers";

describe("PROVIDER_META integrity", () => {
  it("every ordered provider exists in meta", () => {
    for (const id of PROVIDER_ORDER) {
      expect(PROVIDER_META[/** @type {ProviderId} */ (id)], `provider ${id} missing from PROVIDER_META`).toBeDefined();
    }
  });
  it("every provider has a non-empty models array", () => {
    for (const [id, meta] of Object.entries(PROVIDER_META)) {
      if (id === "local") continue; // local is user-defined
      expect(Array.isArray(meta.models), `${id}.models is not array`).toBe(true);
      expect(meta.models.length, `${id}.models is empty`).toBeGreaterThan(0);
    }
  });
  it("every model ID is a non-empty string", () => {
    for (const [id, meta] of Object.entries(PROVIDER_META)) {
      for (const m of meta.models || []) {
        expect(typeof m.id, `${id}: model ID is not a string`).toBe("string");
        expect(m.id.trim().length, `${id}: model ID is blank`).toBeGreaterThan(0);
      }
    }
  });
});
