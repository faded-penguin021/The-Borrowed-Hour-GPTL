import { ENC_PREFIX, decryptSecret, encryptSecret } from "../storage/encryption";
import { getSessionPassphrase, setSessionPassphrase, clearSessionPassphrase, requestPassphrase } from "../passphrase";

export async function getTtsElevenLabsKey(): Promise<string | null> {
  const stored = localStorage.getItem("borrowed:tts_elevenlabs_key:v1");
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored.trim();
  if (!getSessionPassphrase()) {
    setSessionPassphrase(await requestPassphrase("Enter your session passphrase to unlock API keys:"));
  }
  const passphrase = getSessionPassphrase();
  if (!passphrase) return null;
  try { return (await decryptSecret(stored, passphrase)).trim(); }
  catch { clearSessionPassphrase(); return null; }
}
export async function saveTtsElevenLabsKey(plain: string | null): Promise<void> {
  if (!plain) { localStorage.removeItem("borrowed:tts_elevenlabs_key:v1"); return; }
  const passphrase = getSessionPassphrase();
  if (passphrase) {
    localStorage.setItem("borrowed:tts_elevenlabs_key:v1", await encryptSecret(plain.trim(), passphrase));
  } else {
    localStorage.setItem("borrowed:tts_elevenlabs_key:v1", plain.trim());
  }
}
