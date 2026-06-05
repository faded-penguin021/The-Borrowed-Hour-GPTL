import { encryptWithKey } from "../storage/encryption";
import { decryptStored, getSessionKey, isUnlocked } from "../passphrase";

const KEY = "borrowed:tts_google_key:v1";

export async function getTtsGoogleKey(): Promise<string | null> {
  const stored = localStorage.getItem(KEY);
  if (!stored) return null;
  try { return await decryptStored(KEY, stored); }
  catch { return null; }
}
export async function saveTtsGoogleKey(plain: string | null): Promise<void> {
  if (!plain) { localStorage.removeItem(KEY); return; }
  const key = getSessionKey();
  if (isUnlocked() && key) {
    localStorage.setItem(KEY, await encryptWithKey(key, plain.trim()));
  } else {
    localStorage.setItem(KEY, plain.trim());
  }
}
