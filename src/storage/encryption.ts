// Secret-at-rest encryption for browser-stored API keys.
//
// What this defends and what it does NOT defend:
//   - DEFENDED: a *passive read* of browser storage (someone copying
//     localStorage off the device, an extension peeking at saved values).
//     Stored keys are AES-GCM ciphertext; a casual peek finds only noise.
//   - NOT DEFENDED: any code running on the page (XSS). While a session is
//     unlocked, in-page script can call decryptWithKey() with the cached
//     session key just as the app does. The real anti-XSS defenses are the
//     strict CSP, the absence of innerHTML/eval, and bring-your-own-key — not
//     this module. See THREAT_MODEL.md.
//
// v2 format (current): one non-extractable AES key is derived *once per unlock*
// from the passphrase + a per-install KDF salt (public, persisted in
// localStorage). Individual blobs carry only iv + ciphertext. The derived key
// is non-extractable, so even in-page script cannot exfiltrate it as raw bytes.
//
// v1 format (legacy): each blob carried its own random salt and re-derived a key
// from the raw passphrase on every call. Still readable via decryptSecretV1 for
// back-compat; the unlock-time migration sweep rewrites v1 blobs to v2.

export const ENC_PREFIX_V1 = "enc:v1:"; // legacy: b64(salt).b64(iv).b64(ct)  (self-contained salt)
export const ENC_PREFIX_V2 = "enc:v2:"; // current: b64(iv).b64(ct)            (salt = install salt)
export const ENC_PREFIX = ENC_PREFIX_V2; // default prefix for new writes

// The KDF salt is NOT secret — it only ensures derived keys differ per install
// and frustrates precomputed-table attacks. Storing it in plaintext localStorage
// is correct and expected; it is useless to an attacker without the passphrase.
const SALT_KEY = "borrowed:kdf-salt:v1";

const KDF = { name: "PBKDF2", hash: "SHA-256", iterations: 310000 };
const AES = { name: "AES-GCM", length: 256 };

const toB64 = (b: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

export const isV1 = (bundle: string): boolean => bundle.startsWith(ENC_PREFIX_V1);
export const isV2 = (bundle: string): boolean => bundle.startsWith(ENC_PREFIX_V2);
export const isEncrypted = (bundle: string): boolean => isV1(bundle) || isV2(bundle);

/** True if a KDF salt has been persisted for this install. */
export function hasKdfSalt(): boolean {
  const v = localStorage.getItem(SALT_KEY);
  return !!v && v.length > 0;
}

/**
 * Read the persisted per-install KDF salt, creating and persisting a fresh
 * random one on first use. The salt is public (see note above).
 */
export function getOrCreateKdfSalt(): Uint8Array<ArrayBuffer> {
  const existing = localStorage.getItem(SALT_KEY);
  if (existing) {
    try {
      const bytes = fromB64(existing);
      if (bytes.length) return bytes;
    } catch {
      // Corrupt salt — fall through and regenerate. Callers that hold v2 blobs
      // must guard against this case *before* calling (see hasKdfSalt), or the
      // regenerated salt will derive a key that can't decrypt them.
    }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, toB64(salt));
  return salt;
}

/** True if any v2 ciphertext blob is present in localStorage. */
export function hasEncryptedV2Blobs(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = k ? localStorage.getItem(k) : null;
    if (v && isV2(v)) return true;
  }
  return false;
}

/**
 * Derive the session key from a passphrase + the per-install salt. The key is
 * AES-GCM, non-extractable — usable for encrypt/decrypt but its raw bytes can
 * never be read back out, even by in-page script. Run once per unlock.
 */
export async function deriveSessionKey(passphrase: string): Promise<CryptoKey> {
  const salt = getOrCreateKdfSalt();
  const km = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { ...KDF, salt }, km, AES, false, ["encrypt", "decrypt"]);
}

/** Encrypt plaintext with an already-derived session key → enc:v2: bundle. */
export async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return ENC_PREFIX_V2 + `${toB64(iv)}.${toB64(ct)}`;
}

/** Decrypt an enc:v2: bundle with the session key. Throws on a non-v2 bundle. */
export async function decryptWithKey(key: CryptoKey, bundle: string): Promise<string> {
  if (!isV2(bundle))
    throw new Error("Not a v2 ciphertext bundle.");
  const [iv, ct] = bundle.slice(ENC_PREFIX_V2.length).split(".");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}

/**
 * Decrypt a legacy enc:v1: bundle. Each v1 blob is self-contained (carries its
 * own salt), so it needs the raw passphrase and re-derives a one-off key.
 */
export async function decryptSecretV1(bundle: string, passphrase: string): Promise<string> {
  const [s, iv, ct] = bundle.slice(ENC_PREFIX_V1.length).split(".");
  const km = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { ...KDF, salt: fromB64(s) }, km, AES, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}

/**
 * One-time unlock sweep: rewrite every legacy v1 blob in localStorage as v2
 * under the freshly-derived session key. Runs while the passphrase is still on
 * the stack (inside the unlock tick) so that afterwards only the CryptoKey is
 * needed and no v1 blobs remain. Best-effort per blob: a blob encrypted under a
 * *different* passphrase simply won't decrypt and is left untouched.
 */
export async function migrateV1Blobs(passphrase: string, key: CryptoKey): Promise<void> {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (!v || !isV1(v)) continue;
    try {
      const plain = await decryptSecretV1(v, passphrase);
      localStorage.setItem(k, await encryptWithKey(key, plain));
    } catch {
      // Different passphrase or corrupt blob — leave it as-is.
    }
  }
}
