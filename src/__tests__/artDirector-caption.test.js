import { describe, it, expect } from "vitest";
import { cleanPlateCaption } from "../llm/artDirector.js";

describe("cleanPlateCaption — epistemic-leak guard", () => {
  it("keeps clean descriptive captions, trimming quotes/punctuation", () => {
    expect(cleanPlateCaption("The woman in the green coat")).toBe("The woman in the green coat");
    expect(cleanPlateCaption('"Holborn, from the eastbound platform."')).toBe("Holborn, from the eastbound platform");
    expect(cleanPlateCaption("  The reliquary, unopened  ")).toBe("The reliquary, unopened");
  });

  it("drops captions that leak significance / gate reasoning", () => {
    const leaks = [
      "routine conversation, no significant shift or reveal",
      "The turning point",
      "a moment of tension",
      "The reveal of the conspirator",
      "nothing notable",
      "the major beat of the scene",
      "a routine transit moment"
    ];
    for (const c of leaks) expect(cleanPlateCaption(c), c).toBe("");
  });

  it("drops sentence-like or over-long captions", () => {
    expect(cleanPlateCaption("She turns to you and asks a question you did not expect to hear")).toBe("");
    expect(cleanPlateCaption("")).toBe("");
    expect(cleanPlateCaption(undefined)).toBe("");
  });
});
