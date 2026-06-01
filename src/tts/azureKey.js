// @ts-check
import { ENC_PREFIX, decryptSecret, encryptSecret } from "../storage/encryption";
import { getSessionPassphrase, setSessionPassphrase, clearSessionPassphrase } from "../passphrase";

/** @returns {Promise<string | null>} */
export async function getTtsAzureKey() {
  const stored = localStorage.getItem("borrowed:tts_azure_key:v1");
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
/** @param {string | null} plain @returns {Promise<void>} */
export async function saveTtsAzureKey(plain) {
  if (!plain) { localStorage.removeItem("borrowed:tts_azure_key:v1"); return; }
  const passphrase = getSessionPassphrase();
  if (passphrase) {
    localStorage.setItem("borrowed:tts_azure_key:v1", await encryptSecret(plain.trim(), passphrase));
  } else {
    localStorage.setItem("borrowed:tts_azure_key:v1", plain.trim());
  }
}
/** @returns {string} */
export function getTtsAzureRegion() {
  return localStorage.getItem("borrowed:tts_azure_region:v1") || "eastus";
}
/** @param {string | null} region @returns {void} */
export function saveTtsAzureRegion(region) {
  if (!region) { localStorage.removeItem("borrowed:tts_azure_region:v1"); return; }
  localStorage.setItem("borrowed:tts_azure_region:v1", region.trim());
}
