import { describe, it, expect } from "vitest";
import { cleanPlateCaption, captionFromScene } from "../llm/artDirector";

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
    expect(cleanPlateCaption(undefined as unknown as string)).toBe("");
  });
});

describe("captionFromScene — descriptive fallback from the visual scene clause", () => {
  it("takes a short opening visual phrase, capitalized", () => {
    expect(captionFromScene("The reliquary, unopened, on a velvet cloth")).toBe("The reliquary");
    expect(captionFromScene("Holborn station — the 8:11 nearing")).toBe("Holborn station");
    expect(captionFromScene("A woman in a green coat, lamplight on wet stone")).toBe("A woman in a green coat");
  });

  it("never truncates a long opening phrase — omits the caption instead", () => {
    // A long opening phrase with no early natural break must not be sliced
    // mid-thought; a cut-off engraving reads as a bug, so we show none at all.
    expect(captionFromScene("a woman in a green coat on the eastbound platform, lamplight on wet stone")).toBe("");
    expect(captionFromScene("the vast cathedral nave stretching away into candlelit gloom above kneeling figures")).toBe("");
  });

  it("returns empty for empty/whitespace input", () => {
    expect(captionFromScene("")).toBe("");
    expect(captionFromScene("   ")).toBe("");
    expect(captionFromScene(undefined as unknown as string)).toBe("");
  });
});
