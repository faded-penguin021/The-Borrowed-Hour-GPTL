import type { ProviderId } from "../types";
import { describe, it, expect } from "vitest";
import { PROVIDER_META, PROVIDER_ORDER, FREE_MODELS_BY_PROVIDER } from "../llm/providers";

describe("PROVIDER_META integrity", () => {
  it("every ordered provider exists in meta", () => {
    for (const id of PROVIDER_ORDER) {
      expect(PROVIDER_META[id as ProviderId], `provider ${id} missing from PROVIDER_META`).toBeDefined();
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

describe("FREE_MODELS_BY_PROVIDER ↔ PROVIDER_META", () => {
  // Every default opener/gm/narrator must reference a model that actually exists
  // in its provider's preset list. Otherwise the curated default selects an id
  // the picker never offers (and which may 404 at the provider). This is the
  // invariant an automated catalogue refresh is most likely to break, so the
  // detector + this test guard it together (see docs/model-catalogue-maintenance.md).
  const table = FREE_MODELS_BY_PROVIDER as Record<
    string,
    { provider?: string; opener: string; gm: string; narrator: string }
  >;
  for (const [key, picks] of Object.entries(table)) {
    // The synthetic "free" entry names its provider explicitly; the rest are keyed by it.
    const providerId = (key === "free" ? picks.provider : key) as ProviderId;
    it(`${key}: opener/gm/narrator exist in PROVIDER_META.${providerId}`, () => {
      const meta = PROVIDER_META[providerId];
      expect(meta, `unknown provider "${providerId}"`).toBeDefined();
      const ids = new Set(meta.models.map((m) => m.id));
      for (const role of ["opener", "gm", "narrator"] as const) {
        expect(
          ids.has(picks[role]),
          `${key}.${role} "${picks[role]}" is not in PROVIDER_META.${providerId}.models`
        ).toBe(true);
      }
    });
  }
});
