// @vitest-environment jsdom
//
// jsdom gives us localStorage + btoa/atob, and under Node 20+ the global
// `crypto` (with a real SubtleCrypto) is present in the jsdom environment too,
// so deriveKey/encrypt/decrypt work without any shim.
import { beforeEach, describe, it, expect } from "vitest";
import {
  ENC_PREFIX_V1,
  ENC_PREFIX_V2,
  deriveSessionKey,
  encryptWithKey,
  decryptWithKey,
  decryptSecretV1,
  getOrCreateKdfSalt,
  hasKdfSalt,
  hasEncryptedV2Blobs,
  migrateV1Blobs,
  isV1,
  isV2,
  isEncrypted,
} from "./encryption";

beforeEach(() => {
  localStorage.clear();
});

/** Produce a legacy v1 blob the way the old encryptSecret did (self-contained salt). */
async function makeV1Blob(plaintext: string, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: 310000, salt },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
  return ENC_PREFIX_V1 + `${b64(salt)}.${b64(iv)}.${b64(ct)}`;
}

describe("encryption v2 round-trip", () => {
  it("derives a session key, encrypts, and decrypts back", async () => {
    const key = await deriveSessionKey("correct horse battery staple");
    const bundle = await encryptWithKey(key, "sk-secret-123");
    expect(bundle.startsWith(ENC_PREFIX_V2)).toBe(true);
    expect(isV2(bundle)).toBe(true);
    expect(isEncrypted(bundle)).toBe(true);
    expect(await decryptWithKey(key, bundle)).toBe("sk-secret-123");
  });

  it("the derived session key is non-extractable", async () => {
    const key = await deriveSessionKey("pw");
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toBeTruthy();
  });

  it("rejects decryption under a key derived from a different passphrase", async () => {
    const a = await deriveSessionKey("passphrase-A");
    const bundle = await encryptWithKey(a, "secret");
    // A different passphrase against the same install salt → different key.
    const b = await deriveSessionKey("passphrase-B");
    await expect(decryptWithKey(b, bundle)).rejects.toBeTruthy();
  });

  it("refuses a non-v2 bundle", async () => {
    const key = await deriveSessionKey("pw");
    await expect(decryptWithKey(key, "enc:v1:not-a-v2-bundle")).rejects.toThrow();
  });
});

describe("v1 back-compat", () => {
  it("decrypts a legacy v1 blob with its passphrase", async () => {
    const blob = await makeV1Blob("legacy-secret", "old-pass");
    expect(isV1(blob)).toBe(true);
    expect(await decryptSecretV1(blob, "old-pass")).toBe("legacy-secret");
  });
});

describe("getOrCreateKdfSalt", () => {
  it("is idempotent and persists across calls", () => {
    expect(hasKdfSalt()).toBe(false);
    const first = getOrCreateKdfSalt();
    expect(hasKdfSalt()).toBe(true);
    const second = getOrCreateKdfSalt();
    expect(Array.from(second)).toEqual(Array.from(first));
    // A fresh read straight from storage matches too.
    expect(localStorage.getItem("borrowed:kdf-salt:v1")).toBeTruthy();
  });
});

describe("hasEncryptedV2Blobs", () => {
  it("detects v2 ciphertext in storage and ignores plaintext", async () => {
    expect(hasEncryptedV2Blobs()).toBe(false);
    localStorage.setItem("borrowed:plain", "not-encrypted");
    expect(hasEncryptedV2Blobs()).toBe(false);
    const key = await deriveSessionKey("pw");
    localStorage.setItem("borrowed:enc", await encryptWithKey(key, "x"));
    expect(hasEncryptedV2Blobs()).toBe(true);
  });
});

describe("migrateV1Blobs", () => {
  it("rewrites a v1 blob as v2 and leaves it decryptable", async () => {
    const STORE = "borrowed:gemini_api_key:v1";
    localStorage.setItem(STORE, await makeV1Blob("my-key", "shared-pass"));
    localStorage.setItem("borrowed:plain", "leave-me");

    const key = await deriveSessionKey("shared-pass");
    await migrateV1Blobs("shared-pass", key);

    const migrated = localStorage.getItem(STORE)!;
    expect(isV2(migrated)).toBe(true);
    expect(await decryptWithKey(key, migrated)).toBe("my-key");
    // Plaintext values are untouched.
    expect(localStorage.getItem("borrowed:plain")).toBe("leave-me");
  });

  it("leaves a v1 blob encrypted under a different passphrase untouched", async () => {
    const STORE = "borrowed:openai_api_key:v1";
    const original = await makeV1Blob("other-key", "different-pass");
    localStorage.setItem(STORE, original);

    const key = await deriveSessionKey("shared-pass");
    await migrateV1Blobs("shared-pass", key);

    expect(localStorage.getItem(STORE)).toBe(original);
    expect(isV1(localStorage.getItem(STORE)!)).toBe(true);
  });
});
