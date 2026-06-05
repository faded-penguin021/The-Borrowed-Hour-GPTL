import { encryptWithKey } from "../storage/encryption";
import { decryptStored, getSessionKey, isUnlocked } from "../passphrase";

const KEY = "borrowed:tts_azure_key:v1";

export async function getTtsAzureKey(): Promise<string | null> {
  const stored = localStorage.getItem(KEY);
  if (!stored) return null;
  try { return await decryptStored(KEY, stored); }
  catch { return null; }
}
export async function saveTtsAzureKey(plain: string | null): Promise<void> {
  if (!plain) { localStorage.removeItem(KEY); return; }
  const key = getSessionKey();
  if (isUnlocked() && key) {
    localStorage.setItem(KEY, await encryptWithKey(key, plain.trim()));
  } else {
    localStorage.setItem(KEY, plain.trim());
  }
}
export function getTtsAzureRegion(): string {
  return localStorage.getItem("borrowed:tts_azure_region:v1") || "eastus";
}
export function saveTtsAzureRegion(region: string | null): void {
  if (!region) { localStorage.removeItem("borrowed:tts_azure_region:v1"); return; }
  localStorage.setItem("borrowed:tts_azure_region:v1", region.trim());
}
