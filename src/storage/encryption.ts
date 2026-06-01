export const ENC_PREFIX = "enc:v1:";
const KDF = { name: "PBKDF2", hash: "SHA-256", iterations: 310000 };
const AES = { name: "AES-GCM", length: 256 };

const toB64 = (b: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

async function deriveKey(passphrase: string, salt: BufferSource): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { ...KDF, salt }, km, AES, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return ENC_PREFIX + `${toB64(salt)}.${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptSecret(bundle: string, passphrase: string): Promise<string> {
  const [s, iv, ct] = bundle.slice(ENC_PREFIX.length).split(".");
  const key = await deriveKey(passphrase, fromB64(s));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}
