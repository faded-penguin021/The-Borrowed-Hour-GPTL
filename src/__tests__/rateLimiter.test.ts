import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "../llm/rateLimiter";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("createRateLimiter", () => {
  it("allows burst up to maxTokens without waiting", async () => {
    const limiter = createRateLimiter({ maxTokens: 3, refillPerSecond: 1 });
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
  });

  it("waits when tokens are exhausted", async () => {
    const limiter = createRateLimiter({ maxTokens: 1, refillPerSecond: 1 });
    await limiter.acquire();
    const p = limiter.acquire();
    let resolved = false;
    p.then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(resolved).toBe(true);
  });

  it("rejects when signal is already aborted", async () => {
    const limiter = createRateLimiter({ maxTokens: 0, refillPerSecond: 1 });
    const controller = new AbortController();
    controller.abort();
    await expect(limiter.acquire(controller.signal)).rejects.toThrow("Rate limiter aborted");
  });

  it("rejects when signal is aborted while waiting", async () => {
    const limiter = createRateLimiter({ maxTokens: 0, refillPerSecond: 1 });
    const controller = new AbortController();
    const p = limiter.acquire(controller.signal);
    controller.abort();
    await expect(p).rejects.toThrow("Rate limiter aborted");
  });

  it("refills tokens over time", async () => {
    const limiter = createRateLimiter({ maxTokens: 2, refillPerSecond: 2 });
    await limiter.acquire();
    await limiter.acquire();
    await vi.advanceTimersByTimeAsync(1000);
    await limiter.acquire();
    await limiter.acquire();
  });
});
