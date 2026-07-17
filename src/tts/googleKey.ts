import { decryptStored, encryptForStorage } from "../passphrase";

const KEY = "borrowed:tts_google_key:v1";

export async function getTtsGoogleKey(): Promise<string | null> {
  const stored = localStorage.getItem(KEY);
  if (!stored) return null;
  try { return await decryptStored(KEY, stored); }
  catch { return null; }
}
export async function saveTtsGoogleKey(plain: string | null): Promise<void> {
  if (!plain) { localStorage.removeItem(KEY); return; }
  const blob = await encryptForStorage(plain);
  if (blob == null) return; // cancelled — leave any stored value untouched
  localStorage.setItem(KEY, blob);
}
