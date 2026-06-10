import { describe, it, expect } from "vitest";
import { IMAGE_PROVIDER_META, IMAGE_PROVIDER_ORDER } from "../llm/imaging";

describe("IMAGE_PROVIDER_META integrity", () => {
  it("every ordered provider exists in meta", () => {
    for (const id of IMAGE_PROVIDER_ORDER) {
      expect(
        IMAGE_PROVIDER_META[id as keyof typeof IMAGE_PROVIDER_META],
        `provider ${id} missing from IMAGE_PROVIDER_META`
      ).toBeDefined();
    }
  });
  it("every defaultModel exists in its models list", () => {
    // The picker offers `models`; `defaultModel` is what a fresh or auto config
    // selects. If the default isn't in the list it points at a model the user
    // can't pick (and that may 404). `local` ships no preset models — skip it.
    // The twin of the LLM/TTS default checks.
    for (const [id, meta] of Object.entries(IMAGE_PROVIDER_META)) {
      if (!meta.defaultModel) continue;
      const ids = meta.models.map((m) => m.id);
      expect(
        ids,
        `${id}.defaultModel "${meta.defaultModel}" not in models [${ids.join(", ")}]`
      ).toContain(meta.defaultModel);
    }
  });
  it("every model ID is a non-empty string", () => {
    for (const [id, meta] of Object.entries(IMAGE_PROVIDER_META)) {
      for (const m of meta.models) {
        expect(typeof m.id, `${id}: model ID is not a string`).toBe("string");
        expect(m.id.trim().length, `${id}: model ID is blank`).toBeGreaterThan(0);
      }
    }
  });
});
