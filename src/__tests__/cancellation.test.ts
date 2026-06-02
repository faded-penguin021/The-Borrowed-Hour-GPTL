import type { Entry, ThrownError } from "../types";
import { describe, it, expect } from "vitest";

describe("abort / cancellation contract", () => {
  it("AbortController.abort() causes subsequent fetch to throw AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchLike = async (signal: AbortSignal) => {
      if (signal.aborted) {
        const e = new DOMException("The operation was aborted.", "AbortError");
        throw e;
      }
      return "data";
    };
    await expect(fetchLike(controller.signal)).rejects.toThrow("aborted");
    try {
      await fetchLike(controller.signal);
    } catch (e) {
      expect((e as ThrownError).name).toBe("AbortError");
    }
  });

  it("rollback restores previous state on cancellation", () => {
    let entries = [{ type: "narration", text: "opening" }];
    let history = [{ role: "assistant", content: "{}" }];
    const previousEntries = entries;
    const previousHistory = history;

    entries = [...entries, { type: "action", text: "go north" }];
    history = [...history, { role: "user", content: "go north" }];

    const rollback = () => {
      entries = previousEntries;
      history = previousHistory;
    };

    const controller = new AbortController();
    controller.abort();

    rollback();
    expect(entries).toBe(previousEntries);
    expect(entries).toHaveLength(1);
    expect(history).toBe(previousHistory);
    expect(history).toHaveLength(1);
  });

  it("cancelRequest pattern: rollback + abort + loading reset", () => {
    let loading = true;
    let error = null;
    let entries = [{ type: "narration", text: "original" }];
    const previousEntries = entries;

    entries = [...entries, { type: "action", text: "open door" }];

    const controller = new AbortController();
    const rollback = () => { entries = previousEntries; };
    const _abortRef = { controller, rollback, startedAt: Date.now() };

    // Simulate cancelRequest
    loading = false;
    error = null;
    rollback();
    controller.abort();

    expect(loading).toBe(false);
    expect(error).toBeNull();
    expect(entries).toBe(previousEntries);
    expect(entries).toHaveLength(1);
    expect(controller.signal.aborted).toBe(true);
  });
});

describe("turn-scoped stale detection (codex pattern)", () => {
  it("stale() returns true when turnId has advanced", () => {
    const turnIdRef = { current: 0 };
    const myTurn = ++turnIdRef.current;
    const stale = () => myTurn !== turnIdRef.current;

    expect(stale()).toBe(false);
    ++turnIdRef.current;
    expect(stale()).toBe(true);
  });

  it("stale() returns true when signal is aborted", () => {
    const turnIdRef = { current: 0 };
    const myTurn = ++turnIdRef.current;
    const controller = new AbortController();
    const stale = () => controller.signal.aborted || myTurn !== turnIdRef.current;

    expect(stale()).toBe(false);
    controller.abort();
    expect(stale()).toBe(true);
  });

  it("concurrent turn supersedes previous — only latest turn proceeds", async () => {
    const turnIdRef = { current: 0 };
    const inflightRef = { current: 0 };
    const MAX_INFLIGHT = 2;
    const results: string[] = [];

    const simulateTurn = async (delay: number, label: string) => {
      const myTurn = ++turnIdRef.current;
      const stale = () => myTurn !== turnIdRef.current;

      await new Promise((r) => setTimeout(r, delay));
      if (stale()) { results.push(`${label}:stale`); return; }

      if (inflightRef.current >= MAX_INFLIGHT) { results.push(`${label}:gated`); return; }
      inflightRef.current++;
      try {
        await new Promise((r) => setTimeout(r, 5));
        if (stale()) { results.push(`${label}:stale-late`); return; }
        results.push(`${label}:ok`);
      } finally {
        inflightRef.current--;
      }
    };

    const p1 = simulateTurn(20, "turn1");
    const p2 = simulateTurn(5, "turn2");
    const p3 = simulateTurn(1, "turn3");
    await Promise.all([p1, p2, p3]);

    expect(results).toContain("turn1:stale");
    expect(results).toContain("turn2:stale");
    expect(results).toContain("turn3:ok");
  });

  it("inflight gate prevents exceeding MAX_INFLIGHT", async () => {
    const inflightRef = { current: 0 };
    const MAX_INFLIGHT = 2;
    const turnIdRef = { current: 0 };
    const results: string[] = [];

    const simulateImage = async (label: string) => {
      const _myTurn = turnIdRef.current;
      if (inflightRef.current >= MAX_INFLIGHT) { results.push(`${label}:gated`); return; }
      inflightRef.current++;
      try {
        await new Promise((r) => setTimeout(r, 10));
        results.push(`${label}:ok`);
      } finally {
        inflightRef.current--;
      }
    };

    turnIdRef.current = 1;
    const p1 = simulateImage("img1");
    const p2 = simulateImage("img2");
    const p3 = simulateImage("img3");
    await Promise.all([p1, p2, p3]);

    const oks = results.filter((r) => r.endsWith(":ok")).length;
    const gated = results.filter((r) => r.endsWith(":gated")).length;
    expect(oks).toBe(2);
    expect(gated).toBe(1);
  });
});

describe("blob URL lifecycle", () => {
  it("revokeObjectURL is safe to call on non-blob URLs", () => {
    const revoke = (url: string | null | undefined) => {
      if (typeof url === "string" && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    };
    expect(() => revoke("data:image/png;base64,abc")).not.toThrow();
    expect(() => revoke("https://example.com/img.png")).not.toThrow();
    expect(() => revoke("")).not.toThrow();
    expect(() => revoke(null)).not.toThrow();
    expect(() => revoke(undefined)).not.toThrow();
  });

  it("revokes only blob: URLs from an entries array", () => {
    const revoked: string[] = [];
    const mockRevoke = (url: string) => revoked.push(url);
    const revokeAllPlates = (entries: Entry[]) => {
      for (const e of entries) {
        const url = e?.illustration?.url;
        if (typeof url === "string" && url.startsWith("blob:")) mockRevoke(url);
      }
    };

    const entries = [
      { type: "narration", text: "hello" },
      { type: "narration", text: "world", illustration: { status: "ready", url: "blob:http://localhost/abc" } },
      { type: "narration", text: "test", illustration: { status: "ready", url: "data:image/png;base64,xyz" } },
      { type: "action", text: "go north" },
      { type: "narration", text: "dark", illustration: { status: "failed" } },
    ];

    revokeAllPlates(entries as Entry[]);
    expect(revoked).toEqual(["blob:http://localhost/abc"]);
  });
});
