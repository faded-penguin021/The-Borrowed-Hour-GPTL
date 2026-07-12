// @vitest-environment jsdom
//
// Request-level behavior of createLLMClient that the gameLoop tests (which
// stub callAPI itself) can't see: the temperature-rejection memo and the
// keyless BYOB proxy path. fetch is the only boundary stubbed — request
// building, key resolution, retry accounting, and extraction all run for real.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLLMClient } from "../llm/client";
import { BorrowedError } from "../llm/errors";
import type { EngineConfig } from "../types";

const ENGINE: EngineConfig = { provider: "mistral", model: "mistral-large-latest" };
const KEY_WINDOW = "MISTRAL_API_KEY";
const KEY_STORAGE = "borrowed:mistral_api_key:v1";

const okResponse = (content: string) => ({
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => ({ choices: [{ message: { content } }] })
});

const errResponse = (status: number, message: string) => ({
  ok: false,
  status,
  text: async () => JSON.stringify({ error: { message } })
});

function makeClient(getProxyUrl?: () => string | undefined) {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const client = createLLMClient({
    getDefaultEngine: () => ENGINE,
    onUsage: () => {},
    getProxyUrl
  });
  return { client, fetchMock };
}

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body);

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[KEY_WINDOW];
  localStorage.removeItem(KEY_STORAGE);
  vi.unstubAllGlobals();
});

describe("temperature-rejection memo", () => {
  beforeEach(() => {
    (window as unknown as Record<string, string>)[KEY_WINDOW] = "test-key-123";
  });

  it("retries without temperature after a 400 naming it, then omits it up front", async () => {
    const { client, fetchMock } = makeClient();
    fetchMock
      .mockResolvedValueOnce(errResponse(400, "temperature is not supported with this model"))
      .mockResolvedValueOnce(okResponse("first"))
      .mockResolvedValueOnce(okResponse("second"));

    await expect(
      client.callAPI("sys", [{ role: "user", content: "hi" }], false, ENGINE, 100, 0.7)
    ).resolves.toBe("first");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchMock.mock.calls[0]).temperature).toBe(0.7);
    expect(bodyOf(fetchMock.mock.calls[1]).temperature).toBeUndefined();

    // Remembered for the session: the next call never sends temperature, so
    // there is no second failed round-trip to re-learn the rejection.
    await expect(
      client.callAPI("sys", [{ role: "user", content: "again" }], false, ENGINE, 100, 0.7)
    ).resolves.toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bodyOf(fetchMock.mock.calls[2]).temperature).toBeUndefined();
  });

  it("does not swallow unrelated 400s", async () => {
    const { client, fetchMock } = makeClient();
    fetchMock.mockResolvedValue(errResponse(400, "model not found"));
    await expect(
      client.callAPI("sys", [{ role: "user", content: "hi" }], false, ENGINE, 100, 0.7)
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("BYOB proxy", () => {
  it("works with no stored key: routes via the proxy and strips auth headers", async () => {
    const { client, fetchMock } = makeClient(() => "https://proxy.example/llm");
    fetchMock.mockResolvedValueOnce(okResponse("proxied"));
    await expect(
      client.callAPI("sys", [{ role: "user", content: "hi" }], false, ENGINE, 100, 0.7)
    ).resolves.toBe("proxied");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url.startsWith("https://proxy.example/llm?target=")).toBe(true);
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("still demands a key when no proxy is configured", async () => {
    const { client, fetchMock } = makeClient();
    const err = await client
      .callAPI("sys", [{ role: "user", content: "hi" }], false, ENGINE, 100, 0.7)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BorrowedError);
    expect((err as BorrowedError).detail).toMatch(/No Mistral API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
