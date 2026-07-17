// @vitest-environment jsdom
//
// Request-shaping invariants of the provider adapters that break silently at
// runtime: the Anthropic CORS opt-in (without it every direct browser call is
// blocked in preflight) and the health-check ping parameters (current
// Anthropic/OpenAI flagships reject `temperature`, and OpenAI's Responses API
// floors max_output_tokens at 16).

import { describe, it, expect, vi, afterEach } from "vitest";
import { PROVIDERS, getProviderKey, checkProviderHealth, applyProxyToRequest } from "../llm/providers";

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).ANTHROPIC_API_KEY;
  delete (window as unknown as Record<string, unknown>).MISTRAL_API_KEY;
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("anthropic request shaping", () => {
  it("sends the direct-browser-access CORS opt-in on every request", () => {
    const request = PROVIDERS.anthropic.buildRequest({
      sys: "s",
      msgs: [{ role: "user", content: "hi" }],
      useTool: false,
      model: "claude-sonnet-5",
      maxTokens: 16,
      tool: null,
      apiKey: "k"
    });
    expect(request.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(request.headers["x-api-key"]).toBe("k");
    // buildStreamRequest delegates to buildRequest, so streaming inherits it.
    expect(PROVIDERS.anthropic.buildStreamRequest).toBeDefined();
  });
});

describe("checkProviderHealth ping", () => {
  it("omits temperature and uses a max_tokens current models accept", async () => {
    (window as unknown as Record<string, string>).ANTHROPIC_API_KEY = "k";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkProviderHealth("anthropic");
    expect(result.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.temperature).toBeUndefined();
    expect(body.max_tokens).toBe(16);
  });
});

describe("checkProviderHealth via BYOB proxy", () => {
  it("routes the ping through the proxy, keyless, with key headers stripped", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkProviderHealth("anthropic", undefined, "https://proxy.example/llm");
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url.startsWith("https://proxy.example/llm?target=")).toBe(true);
    expect(init.headers["x-api-key"]).toBeUndefined();
  });

  it("appends with & when the proxy URL already carries query params", () => {
    const request = { url: "https://api.example/v1/chat", headers: {} };
    applyProxyToRequest(request, "https://proxy.example/llm?token=abc");
    expect(request.url).toBe(
      `https://proxy.example/llm?token=abc&target=${encodeURIComponent("https://api.example/v1/chat")}`
    );
  });
});

describe("getProviderKey allowMissing", () => {
  it("returns empty for a missing key only when the caller allows it", async () => {
    await expect(getProviderKey("mistral", { allowMissing: true })).resolves.toBe("");
    await expect(getProviderKey("mistral")).rejects.toThrow();
  });
});
