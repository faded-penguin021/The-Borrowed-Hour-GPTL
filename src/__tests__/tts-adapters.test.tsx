// @vitest-environment jsdom
//
// Request-shaping coverage for the TTS adapters that had none (openai,
// elevenlabs, azure, browser), mirroring tts-google / tts-voxtral. The
// invariants under test: the key rides in a header and never appears in the URL
// or request body; the endpoint origin is declared in src/security/origins.ts
// (so it's covered by the CSP); and the payload carries the expected fields.
// A non-OK fetch stops the network adapters before the audio plumbing, so the
// captured request is all we assert on.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { OpenAITTSAdapter } from "../tts/adapters/openai";
import { ElevenLabsTTSAdapter } from "../tts/adapters/elevenlabs";
import { AzureTTSAdapter } from "../tts/adapters/azure";
import { BrowserTTSAdapter } from "../tts/adapters/browser";
import { CONNECT_SRC_ORIGINS } from "../security/origins";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when a URL's origin is covered by a declared connect-src entry
 * (honoring single-label `*` wildcards, e.g. `https://*.tts.speech...`).
 * Every literal segment is escaped whole, so only the `*` separators become
 * pattern; a metacharacter in a declared origin can never leak into the regex. */
function originAllowed(url: string): boolean {
  const origin = new URL(url).origin;
  return CONNECT_SRC_ORIGINS.some((pat) => {
    if (pat === origin) return true;
    if (!pat.includes("*")) return false;
    const re = new RegExp("^" + pat.split("*").map(escapeRegExp).join("[^.]+") + "$");
    return re.test(origin);
  });
}

const failResponse = (status = 401) =>
  ({ ok: false, status, text: async () => "denied" }) as unknown as Response;

const SECRET = "sk-SUPER-SECRET-KEY";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OpenAITTSAdapter request shaping", () => {
  it("puts the key in the Authorization header, never the URL or body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failResponse());
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAITTSAdapter({ voiceId: "nova", rate: 1.2, key: SECRET, model: "test-tts" });
    await expect(adapter.synthesize("Hello there.")).rejects.toThrow(/HTTP 401/);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(originAllowed(url)).toBe(true);
    expect(url).not.toContain("SECRET");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${SECRET}`);
    expect(String(init.body)).not.toContain("SECRET");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "test-tts", voice: "nova", input: "Hello there.", response_format: "mp3" });
    // rate maps to speed, clamped into the provider's accepted range.
    expect(body.speed).toBe(1.2);
  });

  it("clamps speed to the provider's accepted range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failResponse());
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenAITTSAdapter({ voiceId: "nova", rate: 99, key: SECRET, model: "test-tts" });
    await expect(adapter.synthesize("x")).rejects.toThrow();
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.speed).toBe(4.0);
  });
});

describe("ElevenLabsTTSAdapter request shaping", () => {
  it("puts the key in the xi-api-key header, never the URL or body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failResponse());
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ElevenLabsTTSAdapter({ voiceId: "voice-xyz", rate: 1, key: SECRET, model: "test-model" });
    await expect(adapter.synthesize("Hello.")).rejects.toThrow(/HTTP 401/);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith("https://api.elevenlabs.io/v1/text-to-speech/voice-xyz")).toBe(true);
    expect(originAllowed(url)).toBe(true);
    expect(url).not.toContain("SECRET");
    const headers = init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe(SECRET);
    expect(String(init.body)).not.toContain("SECRET");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ text: "Hello.", model_id: "test-model" });
  });
});

describe("AzureTTSAdapter request shaping", () => {
  it("puts the key in the subscription-key header, never the URL or body, on the region host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failResponse());
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AzureTTSAdapter({ voiceId: "en-US-JennyNeural", rate: 1, key: SECRET, region: "westus" });
    await expect(adapter.synthesize("Hello.")).rejects.toThrow(/HTTP 401/);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://westus.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(originAllowed(url)).toBe(true);
    expect(url).not.toContain("SECRET");
    const headers = init.headers as Record<string, string>;
    expect(headers["Ocp-Apim-Subscription-Key"]).toBe(SECRET);
    // SSML body carries the voice name and the prose, but not the key.
    expect(String(init.body)).toContain("en-US-JennyNeural");
    expect(String(init.body)).not.toContain("SECRET");
  });

  it("escapes XML metacharacters in the SSML body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failResponse());
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new AzureTTSAdapter({ voiceId: "v", rate: 1, key: SECRET, region: "eastus" });
    await expect(adapter.synthesize(`Tom & <Jerry> "said"`)).rejects.toThrow();
    const body = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain("Tom &amp; &lt;Jerry&gt; &quot;said&quot;");
    expect(body).not.toContain("<Jerry>");
  });

  it("refuses to fetch when no key is set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new AzureTTSAdapter({ voiceId: "v", rate: 1, key: "", region: "eastus" });
    await expect(adapter.synthesize("Hello.")).rejects.toThrow(/Azure key missing/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("BrowserTTSAdapter (local Web Speech, no network)", () => {
  class FakeUtterance {
    text: string;
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) { this.text = text; }
  }
  let speak: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance as unknown as typeof SpeechSynthesisUtterance);
    speak = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      getVoices: () => [{ name: "Alice" }, { name: "Bob" }],
      speak,
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    };
  });

  afterEach(() => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  });

  it("never touches the network and clamps the rate into [0.5, 2.0]", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new BrowserTTSAdapter({ voiceId: "Alice", rate: 9 });
    const handle = await adapter.synthesize("Hello.");
    handle.play();

    expect(fetchMock).not.toHaveBeenCalled();
    const utt = speak.mock.calls[0][0] as FakeUtterance;
    expect(utt.rate).toBe(2.0);
    expect((utt.voice as { name: string }).name).toBe("Alice");
  });

  it("rejects when the Web Speech API is unavailable", async () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    const adapter = new BrowserTTSAdapter({ voiceId: null, rate: 1 });
    await expect(adapter.synthesize("Hello.")).rejects.toThrow(/unavailable/i);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const adapter = new BrowserTTSAdapter({ voiceId: null, rate: 1 });
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.synthesize("Hello.", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
