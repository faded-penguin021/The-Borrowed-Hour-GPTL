const HAS_COMPRESSION =
  typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

export async function compressSave(json: string): Promise<ArrayBuffer | string> {
  if (!HAS_COMPRESSION) return json;
  try {
    const blob = new Blob([json]);
    const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let totalLength = 0;
    for (const c of chunks) totalLength += c.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result.buffer;
  } catch {
    return json;
  }
}

export async function decompressSave(data: ArrayBuffer | string): Promise<string> {
  if (typeof data === "string") return data;
  if (!HAS_COMPRESSION) {
    const decoder = new TextDecoder();
    return decoder.decode(data);
  }
  const blob = new Blob([data]);
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let totalLength = 0;
  for (const c of chunks) totalLength += c.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(result);
}

export function isCompressedSave(data: unknown): data is { type: "gz"; data: ArrayBuffer } {
  return data !== null && typeof data === "object" && (data as Record<string, unknown>).type === "gz";
}
