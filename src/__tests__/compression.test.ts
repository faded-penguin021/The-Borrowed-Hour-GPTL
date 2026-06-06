import { describe, it, expect } from "vitest";
import { compressSave, decompressSave, isCompressedSave } from "../saves/compression";

describe("save compression", () => {
  it("round-trips a JSON string through compress/decompress", async () => {
    const json = JSON.stringify({ entries: [{ type: "narration", text: "A door opens." }], history: [] });
    const compressed = await compressSave(json);
    const decompressed = await decompressSave(compressed);
    expect(decompressed).toBe(json);
  });

  it("handles decompression of a plain string (legacy format)", async () => {
    const json = '{"id":"test"}';
    const result = await decompressSave(json);
    expect(result).toBe(json);
  });

  it("isCompressedSave returns true for { type: 'gz', data: ... }", () => {
    expect(isCompressedSave({ type: "gz", data: new ArrayBuffer(0) })).toBe(true);
    expect(isCompressedSave("string")).toBe(false);
    expect(isCompressedSave(null)).toBe(false);
    expect(isCompressedSave({ type: "other" })).toBe(false);
  });
});
