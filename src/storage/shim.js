// @ts-check
/**
 * @import { StorageShim, ThrownError } from "../types"
 */
if (!window.storage) {
  /** @type {StorageShim} */
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { key, value };
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        const caught = /** @type {ThrownError} */ (e);
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
      /** @type {string[]} */
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key !== null && (!prefix || key.startsWith(prefix)))
          keys.push(key);
      }
      keys.sort();
      return { keys };
    }
  };
}
