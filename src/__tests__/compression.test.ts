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

// A corrupted or truncated slot must surface as a rejection, not silently
// decode to garbage — readAutosave (useSaves) relies on that to fall back to
// "no autosave" instead of feeding a mangled record into migrate/the reducer.
describe("save decompression rejects damaged gzip payloads", () => {
  it("rejects a truncated gzip buffer", async () => {
    const json = JSON.stringify({ entries: Array.from({ length: 40 }, (_, i) => ({ type: "narration", text: `line ${i}` })) });
    const compressed = await compressSave(json);
    // This suite assumes the CompressionStream path is active (Node/CI). If the
    // environment lacks it, compressSave returns the raw string and there is no
    // gzip framing to damage — skip rather than assert a false positive.
    if (!(compressed instanceof ArrayBuffer)) return;
    const truncated = compressed.slice(0, Math.min(10, compressed.byteLength));
    await expect(decompressSave(truncated)).rejects.toBeTruthy();
  });

  it("rejects a buffer that is not valid gzip", async () => {
    // Gzip magic bytes (0x1f 0x8b) followed by nonsense: the stream starts to
    // parse, then fails on the malformed body.
    const garbage = new Uint8Array([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    await expect(decompressSave(garbage)).rejects.toBeTruthy();
  });
});
