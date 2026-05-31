import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Minimal in-memory IndexedDB mock ─────────────────────────────────────────
// Just enough surface for imageStore.ts to exercise put/get/getAllKeys/delete
// and the cursor-driven deleteImagesForSave, without a real IndexedDB. Requests
// settle on microtasks, mirroring the async request/transaction model.
function mkReq() {
  return { onsuccess: null, onerror: null, result: undefined, error: null };
}

function makeMockIndexedDB() {
  const stores = new Map(); // storeName -> Map(key -> value)
  const db = {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (n) => { stores.set(n, new Map()); return {}; },
    transaction: (name) => makeTx(stores.get(name)),
  };

  function makeTx(store) {
    const tx = { oncomplete: null, onerror: null, error: null };
    tx.objectStore = () => makeStore(store, tx);
    return tx;
  }

  function makeStore(store, tx) {
    return {
      put: (value, key) => {
        const req = mkReq();
        queueMicrotask(() => { store.set(key, value); req.result = key; req.onsuccess?.(); });
        return req;
      },
      get: (key) => {
        const req = mkReq();
        queueMicrotask(() => { req.result = store.get(key); req.onsuccess?.(); });
        return req;
      },
      getAllKeys: () => {
        const req = mkReq();
        queueMicrotask(() => { req.result = [...store.keys()]; req.onsuccess?.(); });
        return req;
      },
      delete: (key) => {
        const req = mkReq();
        queueMicrotask(() => { store.delete(key); req.result = undefined; req.onsuccess?.(); });
        return req;
      },
      openCursor: () => {
        const req = mkReq();
        const keys = [...store.keys()];
        let i = 0;
        const step = () => {
          if (i >= keys.length) {
            req.result = null;
            req.onsuccess?.();
            if (tx.oncomplete) queueMicrotask(tx.oncomplete);
            return;
          }
          const key = keys[i];
          req.result = {
            key,
            delete: () => store.delete(key),
            continue: () => { i += 1; queueMicrotask(step); },
          };
          req.onsuccess?.();
        };
        queueMicrotask(step);
        return req;
      },
    };
  }

  return {
    _stores: stores,
    open: () => {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: null, error: null };
      queueMicrotask(() => {
        req.result = db;
        if (!stores.has("plates")) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

const blobOf = (text) => new Blob([text], { type: "image/png" });

describe("imageStore", () => {
  describe("with IndexedDB available", () => {
    let store;
    beforeEach(async () => {
      vi.resetModules();
      globalThis.indexedDB = makeMockIndexedDB();
      store = await import("../storage/imageStore.ts");
    });
    afterEach(() => {
      delete globalThis.indexedDB;
    });

    it("reports the store as available", () => {
      expect(store.hasImageStore).toBe(true);
    });

    it("puts and gets a blob round-trip", async () => {
      await store.putImage("s1:0", blobOf("hello"));
      const got = await store.getImage("s1:0");
      expect(got).toBeInstanceOf(Blob);
      expect(await got.text()).toBe("hello");
    });

    it("returns null for a missing key", async () => {
      expect(await store.getImage("nope:9")).toBeNull();
    });

    it("lists stored keys", async () => {
      await store.putImage("s1:0", blobOf("a"));
      await store.putImage("s2:0", blobOf("b"));
      const keys = await store.listKeys();
      expect(keys.sort()).toEqual(["s1:0", "s2:0"]);
    });

    it("deletes a single image", async () => {
      await store.putImage("s1:0", blobOf("a"));
      await store.deleteImage("s1:0");
      expect(await store.getImage("s1:0")).toBeNull();
    });

    it("deletes every plate for one save, leaving others", async () => {
      await store.putImage("s1:0", blobOf("a"));
      await store.putImage("s1:1", blobOf("b"));
      await store.putImage("s2:0", blobOf("c"));
      await store.deleteImagesForSave("s1");
      expect(await store.getImage("s1:0")).toBeNull();
      expect(await store.getImage("s1:1")).toBeNull();
      const survivor = await store.getImage("s2:0");
      expect(survivor).toBeInstanceOf(Blob);
    });
  });

  describe("without IndexedDB (fallback path)", () => {
    let store;
    beforeEach(async () => {
      vi.resetModules();
      delete globalThis.indexedDB;
      store = await import("../storage/imageStore.ts");
    });

    it("reports the store as unavailable", () => {
      expect(store.hasImageStore).toBe(false);
    });

    it("rejects putImage so callers can fall back to inlining", async () => {
      await expect(store.putImage("s1:0", blobOf("a"))).rejects.toBeTruthy();
    });

    it("resolves getImage to null", async () => {
      expect(await store.getImage("s1:0")).toBeNull();
    });

    it("resolves listKeys to an empty array", async () => {
      expect(await store.listKeys()).toEqual([]);
    });

    it("resolves deleteImagesForSave without throwing", async () => {
      await expect(store.deleteImagesForSave("s1")).resolves.toBeUndefined();
    });
  });
});
