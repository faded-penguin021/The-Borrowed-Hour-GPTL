export interface RateLimiterConfig {
  maxTokens: number;
  refillPerSecond: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = { maxTokens: 8, refillPerSecond: 2 };

export function createRateLimiter(config: RateLimiterConfig = DEFAULT_CONFIG) {
  let tokens = config.maxTokens;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(config.maxTokens, tokens + elapsed * config.refillPerSecond);
    lastRefill = now;
  }

  async function acquire(signal?: AbortSignal): Promise<void> {
    refill();
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    const waitMs = ((1 - tokens) / config.refillPerSecond) * 1000;
    if (signal?.aborted) {
      throw new DOMException("Rate limiter aborted", "AbortError");
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        refill();
        tokens = Math.max(0, tokens - 1);
        resolve();
      }, Math.ceil(waitMs));
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Rate limiter aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  return { acquire };
}
