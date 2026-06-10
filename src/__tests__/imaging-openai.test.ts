import { describe, it, expect } from "vitest";
import {
  buildOpenAIImageBody,
  OPENAI_IMAGE_DEFAULT_MODEL,
  OPENAI_IMAGE_DEFAULT_SIZE,
  OPENAI_IMAGE_DEFAULT_QUALITY,
  DEPRECATED_OPENAI_IMAGE_MODELS
} from "../llm/imaging";

// The OpenAI images request is assembled by a pure builder so it can be
// exercised without a browser. These tests pin three things the adapter used to
// get wrong or leave on the table: compliance (no removed params), validation
// (no unknown values reaching the API), and the output_format → MIME mapping.

describe("buildOpenAIImageBody", () => {
  it("applies safe defaults when no config is given", () => {
    const { body, mime } = buildOpenAIImageBody("a quiet cloister");
    expect(body).toMatchObject({
      model: OPENAI_IMAGE_DEFAULT_MODEL,
      prompt: "a quiet cloister",
      n: 1,
      size: OPENAI_IMAGE_DEFAULT_SIZE,
      quality: OPENAI_IMAGE_DEFAULT_QUALITY,
      output_format: "png"
    });
    expect(mime).toBe("image/png");
  });

  it("omits the params gpt-image-2 removed/forbids (compliance)", () => {
    const { body } = buildOpenAIImageBody("x", { background: "transparent", input_fidelity: "high" });
    expect(body).not.toHaveProperty("input_fidelity");
    expect(body).not.toHaveProperty("background");
  });

  it("passes through valid size, quality and output_format", () => {
    const { body, mime } = buildOpenAIImageBody("x", {
      size: "1024x3072",
      quality: "high",
      output_format: "webp"
    });
    expect(body.size).toBe("1024x3072");
    expect(body.quality).toBe("high");
    expect(body.output_format).toBe("webp");
    expect(mime).toBe("image/webp");
  });

  it("derives the right MIME for jpeg", () => {
    expect(buildOpenAIImageBody("x", { output_format: "jpeg" }).mime).toBe("image/jpeg");
  });

  it("falls back to defaults for unknown values rather than sending them", () => {
    const { body, mime } = buildOpenAIImageBody("x", {
      size: "9000x9000",
      quality: "ultra",
      output_format: "tiff"
    });
    expect(body.size).toBe(OPENAI_IMAGE_DEFAULT_SIZE);
    expect(body.quality).toBe(OPENAI_IMAGE_DEFAULT_QUALITY);
    expect(body.output_format).toBe("png");
    expect(mime).toBe("image/png");
  });

  it("upgrades deprecated models to the current flagship", () => {
    for (const dead of DEPRECATED_OPENAI_IMAGE_MODELS) {
      expect(buildOpenAIImageBody("x", { model: dead }).body.model).toBe(OPENAI_IMAGE_DEFAULT_MODEL);
    }
  });

  it("honours an explicit non-deprecated model", () => {
    expect(buildOpenAIImageBody("x", { model: "gpt-image-3" }).body.model).toBe("gpt-image-3");
  });
});
