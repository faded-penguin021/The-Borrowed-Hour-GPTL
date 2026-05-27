import { describe, it, expect } from "vitest";
import { sanitizeAmbience } from "./tables.js";

// sanitizeAmbience is the boundary between LLM tool output and the audio
// engine. It must drop unknown values silently (the engine treats anything
// it receives as legal), preserve explicit null for fade-to-silence, and
// cap the events array to keep one turn from spamming one-shots.

describe("sanitizeAmbience", () => {
  it("returns null for explicit-null input (whole-bed fade)", () => {
    expect(sanitizeAmbience(null)).toBe(null);
  });

  it("returns undefined for non-object input", () => {
    expect(sanitizeAmbience("hall")).toBeUndefined();
    expect(sanitizeAmbience(42)).toBeUndefined();
    expect(sanitizeAmbience(undefined)).toBeUndefined();
  });

  it("returns undefined when no fields are recognized", () => {
    expect(sanitizeAmbience({ banana: "yes" })).toBeUndefined();
    expect(sanitizeAmbience({ space: "subway" })).toBeUndefined();
  });

  it("passes valid space / population / mood through", () => {
    const out = sanitizeAmbience({ space: "hall", population: "crowd", mood: "joyous" });
    expect(out).toEqual({ space: "hall", population: "crowd", mood: "joyous" });
  });

  it("preserves explicit-null per-lane (fade that lane)", () => {
    const out = sanitizeAmbience({ space: "hall", population: null, mood: null });
    expect(out).toEqual({ space: "hall", population: null, mood: null });
  });

  it("drops unknown values from each lane silently", () => {
    const out = sanitizeAmbience({ space: "rooftop", population: "crowd", mood: "ecstatic" });
    expect(out).toEqual({ population: "crowd" });
  });

  it("filters and caps the events array", () => {
    const out = sanitizeAmbience({
      events: ["bell_toll", "not_a_real_event", "door_creak", "wind_gust", "clock_chime", "footsteps_close"]
    });
    expect(out.events).toEqual(["bell_toll", "door_creak", "wind_gust", "clock_chime"]);
  });

  it("omits the events key when all entries are invalid", () => {
    const out = sanitizeAmbience({ events: ["bogus", 1, null], space: "void" });
    expect(out).toEqual({ space: "void" });
  });
});
