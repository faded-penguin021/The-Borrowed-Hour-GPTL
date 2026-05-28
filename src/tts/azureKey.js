import { ENC_PREFIX, decryptSecret, encryptSecret } from "../storage/encryption.js";

export async function getTtsAzureKey() {
  const stored = localStorage.getItem("borrowed:tts_azure_key:v1");
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored.trim();
  if (!window.__sessionPassphrase)
    window.__sessionPassphrase = prompt("Enter your session passphrase to unlock API keys:");
  if (!window.__sessionPassphrase) return null;
  try { return (await decryptSecret(stored, window.__sessionPassphrase)).trim(); }
  catch { window.__sessionPassphrase = null; return null; }
}
export async function saveTtsAzureKey(plain) {
  if (!plain) { localStorage.removeItem("borrowed:tts_azure_key:v1"); return; }
  if (window.__sessionPassphrase) {
    localStorage.setItem("borrowed:tts_azure_key:v1", await encryptSecret(plain.trim(), window.__sessionPassphrase));
  } else {
    localStorage.setItem("borrowed:tts_azure_key:v1", plain.trim());
  }
}
export function getTtsAzureRegion() {
  return localStorage.getItem("borrowed:tts_azure_region:v1") || "eastus";
}
export function saveTtsAzureRegion(region) {
  if (!region) { localStorage.removeItem("borrowed:tts_azure_region:v1"); return; }
  localStorage.setItem("borrowed:tts_azure_region:v1", region.trim());
}
