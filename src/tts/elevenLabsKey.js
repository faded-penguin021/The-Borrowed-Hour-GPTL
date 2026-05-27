import { ENC_PREFIX, decryptSecret, encryptSecret } from "../storage/encryption.js";

export async function getTtsElevenLabsKey() {
  const stored = localStorage.getItem("borrowed:tts_elevenlabs_key:v1");
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored.trim();
  if (!window.__sessionPassphrase)
    window.__sessionPassphrase = prompt("Enter your session passphrase to unlock API keys:");
  if (!window.__sessionPassphrase) return null;
  try { return (await decryptSecret(stored, window.__sessionPassphrase)).trim(); }
  catch { window.__sessionPassphrase = null; return null; }
}
export async function saveTtsElevenLabsKey(plain) {
  if (!plain) { localStorage.removeItem("borrowed:tts_elevenlabs_key:v1"); return; }
  if (window.__sessionPassphrase) {
    localStorage.setItem("borrowed:tts_elevenlabs_key:v1", await encryptSecret(plain.trim(), window.__sessionPassphrase));
  } else {
    localStorage.setItem("borrowed:tts_elevenlabs_key:v1", plain.trim());
  }
}
