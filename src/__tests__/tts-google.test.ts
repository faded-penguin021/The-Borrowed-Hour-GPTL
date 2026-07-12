import { describe, it, expect, afterEach, vi } from "vitest";
import { GoogleTTSAdapter } from "../tts/adapters/google";

afterEach(() => { vi.restoreAllMocks(); });

describe("GoogleTTSAdapter request shaping", () => {
  it("carries the API key in the X-Goog-Api-Key header, never the URL", async () => {
    // A non-OK response stops synthesize before the audio plumbing; the
    // request under test has already been captured by then.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "denied"
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new GoogleTTSAdapter({ voiceId: "en-US-Neural2-C", rate: 1, key: "AIzaSECRET-KEY" });
    await expect(adapter.synthesize("hello")).rejects.toThrow(/HTTP 403/);

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    expect(url).not.toContain("SECRET");
    expect(init.headers["X-Goog-Api-Key"]).toBe("AIzaSECRET-KEY");
  });
});
