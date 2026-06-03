import type { StorageShim, ThrownError } from "../types";
import { hasImageStore, putDoc, getDoc, listDocs, deleteDoc } from "./imageStore";

// Sentinel key that lives in localStorage (never migrated to IDB) to record
// that the one-time migration of localStorage saves to IndexedDB has run.
const MIGRATION_SENTINEL = "shim:idb-migrated:v1";

// Keys to skip during migration (sentinel itself + any non-borrowed keys)
const MIGRATE_PREFIX = "borrowed:";

async function migrateFromLocalStorage(): Promise<void> {
  if (!hasImageStore) return;
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_SENTINEL)) return;
  const toMigrate: Array<[string, string]> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(MIGRATE_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) toMigrate.push([key, value]);
  }
  for (const [key, value] of toMigrate) {
    try {
      await putDoc(key, value);
      localStorage.removeItem(key);
    } catch {
      // If IDB write fails for this key, leave it in localStorage.
    }
  }
  localStorage.setItem(MIGRATION_SENTINEL, "1");
}

if (!window.storage) {
  // Start migration immediately; gate each shim operation on its completion
  // so the first read doesn't race against the migration.
  const migration: Promise<void> = hasImageStore
    ? migrateFromLocalStorage().catch(() => {})
    : Promise.resolve();

  const idbShim: StorageShim = {
    async get(key) {
      await migration;
      const value = await getDoc(key);
      return value !== null ? { key, value } : null;
    },
    async set(key, value) {
      await migration;
      await putDoc(key, value);
      return { key, value };
    },
    async delete(key) {
      await migration;
      await deleteDoc(key);
      return { key };
    },
    async list(prefix = "") {
      await migration;
      const keys = await listDocs(prefix);
      return { keys: keys.sort() };
    },
  };

  const lsShim: StorageShim = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { key, value };
    },
    async set(key, value) {
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
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key };
    },
    async list(prefix = "") {
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

  window.storage = hasImageStore ? idbShim : lsShim;
}
