// Persistent blob storage for illustration plates, kept out of localStorage so
// the 5MB text bucket can't be blown by a few base64-inlined PNGs (each plate
// is ~200KB–1MB). Saves keep a tiny `idb:${saveId}:${entryIndex}` marker in
// their JSON; the bytes live here in IndexedDB.
//
// Authored in TypeScript — the first strongly-typed module now that the no-TS
// rule is lifted. Vite handles `.ts` out of the box.

const DB_NAME = "borrowed-images";
const DB_VERSION = 1;
const STORE = "plates";

/**
 * True when IndexedDB is usable. Some private-mode/embedded browsers expose the
 * name but throw on open, so callers should still tolerate rejected promises;
 * this guard just lets us short-circuit to the no-op path cheaply.
 */
export const hasImageStore: boolean =
  typeof indexedDB !== "undefined" && indexedDB !== null;

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => {
      // Best-effort: ask the browser to persist this origin's storage so the
      // WebKit 7-day purge policy (iOS PWA) is less likely to evict blobs.
      // Fire-and-forget — no await, no error handling; browsers can say no.
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        navigator.storage.persist();
      }
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
  // If the open fails, drop the cached promise so a later call can retry.
  _dbPromise.catch(() => { _dbPromise = null; });
  return _dbPromise;
}

function runStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/**
 * Store an image blob under `key`. Rejects if IndexedDB is unavailable or the
 * write fails, so callers can fall back to inlining the `data:` payload.
 */
export function putImage(key: string, blob: Blob): Promise<void> {
  if (!hasImageStore) return Promise.reject(new Error("IndexedDB unavailable"));
  return runStore<IDBValidKey>("readwrite", (store) => store.put(blob, key)).then(
    (): void => undefined
  );
}

/** Read an image blob, or `null` if absent / IndexedDB is unavailable. */
export function getImage(key: string): Promise<Blob | null> {
  if (!hasImageStore) return Promise.resolve(null);
  return runStore<Blob | undefined>("readonly", (store) => store.get(key))
    .then((v): Blob | null => (v instanceof Blob ? v : null))
    .catch((): Blob | null => null);
}

/** List every stored key. Returns `[]` if IndexedDB is unavailable. */
export function listKeys(): Promise<string[]> {
  if (!hasImageStore) return Promise.resolve([]);
  return runStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys())
    .then((keys): string[] => keys.map((k) => String(k)))
    .catch((): string[] => []);
}

/**
 * Delete every plate belonging to a save (keys shaped `${saveId}:${index}`), so
 * releasing an hour frees its blobs. Swallows errors — cleanup is best-effort.
 */
export function deleteImagesForSave(saveId: string): Promise<void> {
  if (!hasImageStore) return Promise.resolve();
  const prefix = `${saveId}:`;
  return openDB()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          const store = tx.objectStore(STORE);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            if (String(cursor.key).startsWith(prefix)) cursor.delete();
            cursor.continue();
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    )
    .catch((): void => undefined);
}

/** Delete a single plate by key. Best-effort. */
export function deleteImage(key: string): Promise<void> {
  if (!hasImageStore) return Promise.resolve();
  return runStore<undefined>("readwrite", (store) => store.delete(key))
    .then((): void => undefined)
    .catch((): void => undefined);
}
