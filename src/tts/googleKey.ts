import { ENC_PREFIX, decryptSecret, encryptSecret } from "../storage/encryption";
import { getSessionPassphrase, setSessionPassphrase, clearSessionPassphrase } from "../passphrase";

export async function getTtsGoogleKey(): Promise<string | null> {
  const stored = localStorage.getItem("borrowed:tts_google_key:v1");
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored.trim();
  if (!getSessionPassphrase()) {
    const { requestPassphrase } = await import("../passphrase");
    setSessionPassphrase(await requestPassphrase("Enter your session passphrase to unlock API keys:"));
  }
  const passphrase = getSessionPassphrase();
  if (!passphrase) return null;
  try { return (await decryptSecret(stored, passphrase)).trim(); }
  catch { clearSessionPassphrase(); return null; }
}
export async function saveTtsGoogleKey(plain: string | null): Promise<void> {
  if (!plain) { localStorage.removeItem("borrowed:tts_google_key:v1"); return; }
  const passphrase = getSessionPassphrase();
  if (passphrase) {
    localStorage.setItem("borrowed:tts_google_key:v1", await encryptSecret(plain.trim(), passphrase));
  } else {
    localStorage.setItem("borrowed:tts_google_key:v1", plain.trim());
  }
}
