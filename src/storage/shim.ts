import type { StorageShim, ThrownError } from "../types";
import { SAVE_PREFIX, AUTOSAVE_KEY } from "../data/constants";
import { hasImageStore, putDoc, getDoc, listDocs, deleteDoc } from "./imageStore";

// Only saved chronicles move to IndexedDB — they're the large payloads that can
// blow localStorage's ~5MB ceiling on a long session. The autosave slot is the
// same kind of large payload (rewritten every turn), so it joins them. Everything
// else (settings, API keys, ambience, TTS) is tiny and, crucially, some of it is
// read straight from localStorage elsewhere (providers.ts reads API keys
// directly), so those keys must stay where they are. Routing is by key.
const isSaveKey = (key: string): boolean =>
  key.startsWith(SAVE_PREFIX) || key === AUTOSAVE_KEY;

// Sentinel kept in localStorage (never itself migrated) recording that the
// one-time move of existing localStorage saves into IndexedDB has run.
const MIGRATION_SENTINEL = "borrowed:saves-idb-migrated:v1";

/**
 * Copy any pre-existing `borrowed:save:` records from localStorage into the
 * IndexedDB `saves` store, then drop them from localStorage to reclaim quota.
 * Runs once; gated by a sentinel. Best-effort per key — a failed IDB write
 * leaves that record in localStorage so it isn't lost.
 */
async function migrateSavesToIDB(): Promise<void> {
  if (!hasImageStore) return;
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_SENTINEL)) return;
  const toMigrate: Array<[string, string]> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isSaveKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) toMigrate.push([key, value]);
  }
  for (const [key, value] of toMigrate) {
    try {
      await putDoc(key, value);
      localStorage.removeItem(key);
    } catch {
      // Leave this record in localStorage; the localStorage read path still
      // finds it, so no save is lost.
    }
  }
  localStorage.setItem(MIGRATION_SENTINEL, "1");
}

if (!window.storage) {
  // Kick off the save migration immediately; gate every save-store read/write
  // on it so the first access can't race the move.
  const migration: Promise<void> = hasImageStore
    ? migrateSavesToIDB().catch(() => {})
    : Promise.resolve();

  const getLocal = (key: string) => {
    const value = localStorage.getItem(key);
    return value === null ? null : { key, value };
  };
  const setLocal = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      const caught = e as ThrownError;
      const msg = caught?.message || "";
      if (/quota|storage/i.test(msg) || caught?.name === "QuotaExceededError") {
        const wrapped = new Error(`Storage quota exceeded while saving "${key}" (${Math.round(value.length / 1024)} KB).`);
        wrapped.name = "QuotaExceededError";
        throw wrapped;
      }
      throw e;
    }
    return { key, value };
  };

  const shim: StorageShim = {
    async get(key) {
      if (hasImageStore && isSaveKey(key)) {
        await migration;
        const value = await getDoc(key);
        return value !== null ? { key, value } : null;
      }
      return getLocal(key);
    },
    async set(key, value) {
      if (hasImageStore && isSaveKey(key)) {
        await migration;
        await putDoc(key, value);
        return { key, value };
      }
      return setLocal(key, value);
    },
    async delete(key) {
      if (hasImageStore && isSaveKey(key)) {
        await migration;
        await deleteDoc(key);
        return { key };
      }
      localStorage.removeItem(key);
      return { key };
    },
    async list(prefix = "") {
      // Saves live in IndexedDB; every other namespace lives in localStorage.
      // useSaves is the only caller and always asks for the save prefix, so we
      // route to IDB only for prefixes wholly inside the save namespace — a
      // broader prefix (or "") still reads localStorage and never silently
      // drops its keys.
      if (hasImageStore && prefix.startsWith(SAVE_PREFIX)) {
        await migration;
        const idbKeys = await listDocs(prefix);
        return { keys: idbKeys.sort() };
      }
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key !== null && (!prefix || key.startsWith(prefix)))
          keys.push(key);
      }
      keys.sort();
      return { keys };
    },
  };

  window.storage = shim;
}
