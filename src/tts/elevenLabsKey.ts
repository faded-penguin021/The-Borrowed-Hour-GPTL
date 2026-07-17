import { decryptStored, encryptForStorage } from "../passphrase";

const KEY = "borrowed:tts_elevenlabs_key:v1";

export async function getTtsElevenLabsKey(): Promise<string | null> {
  const stored = localStorage.getItem(KEY);
  if (!stored) return null;
  try { return await decryptStored(KEY, stored); }
  catch { return null; }
}
export async function saveTtsElevenLabsKey(plain: string | null): Promise<void> {
  if (!plain) { localStorage.removeItem(KEY); return; }
  const blob = await encryptForStorage(plain);
  if (blob == null) return; // cancelled — leave any stored value untouched
  localStorage.setItem(KEY, blob);
}
