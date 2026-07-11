import { describe, it, expect, afterEach, vi } from "vitest";
import { fetchVoxtralVoices } from "../tts/adapters/voxtral";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => { vi.restoreAllMocks(); });

describe("fetchVoxtralVoices", () => {
  it("returns [] without a key and never calls the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchVoxtralVoices("")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests limit=100 (never the 422-triggering limit=200) and maps items", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ items: [{ id: "en_paul_neutral", name: "Paul" }, { id: "fr_female" }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    const voices = await fetchVoxtralVoices("sk-key");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
    expect(url).not.toContain("limit=200");
    expect(voices).toEqual([
      { id: "en_paul_neutral", label: "Paul — en_paul_neutral" },
      { id: "fr_female", label: "fr_female" },
    ]);
  });

  it("falls back to the bare endpoint when the params are rejected with 422", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "limit too large" }, 422))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "en_paul_neutral" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const voices = await fetchVoxtralVoices("sk-key");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.mistral.ai/v1/audio/voices");
    expect(voices).toEqual([{ id: "en_paul_neutral", label: "en_paul_neutral" }]);
  });

  it("throws with the HTTP status when the list genuinely fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "bad key" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchVoxtralVoices("sk-key")).rejects.toThrow(/HTTP 401/);
  });
});
