// Passphrase / session-key service boundary.
//
// The session key, pending prompt, and pending resolver live in React-owned
// state inside <PassphraseProvider> (see context/PassphraseContext). This module
// is a thin injection point so non-React callers (the LLM/TTS/image key
// resolvers) can reach the provider's operations through a single typed seam.
//
// Security note: what is held in memory for the session is now a *non-extractable*
// AES `CryptoKey`, never the raw passphrase. The passphrase is consumed
// synchronously at unlock (derive the key, run the v1→v2 migration sweep) and
// then dropped — it is not retained past that tick. A non-extractable key cannot
// be exported as raw bytes even by in-page script, which is a genuine improvement
// over holding the passphrase string. It is NOT a defense against in-page (XSS)
// code while unlocked: such code can still *use* the cached key to decrypt, just
// as the app does. See THREAT_MODEL.md.

import {
  isEncrypted,
  isV2,
  decryptWithKey,
  encryptWithKey,
} from "./storage/encryption";

/** Thrown when a stored blob fails to decrypt with the session key. */
export class WrongPassphraseError extends Error {
  constructor() {
    super("WRONG_PASSPHRASE");
    this.name = "WrongPassphraseError";
  }
}

/**
 * Thrown when v2 ciphertext exists but the KDF salt that derived it is missing
 * or corrupt — the keys are unrecoverable and the only path forward is to clear
 * and re-enter them. Callers must surface this instead of re-prompting (which
 * would loop forever deriving keys that can never decrypt the blobs).
 */
export class KeysUnrecoverableError extends Error {
  constructor() {
    super("KEYS_UNRECOVERABLE");
    this.name = "KeysUnrecoverableError";
  }
}

export const DEFAULT_UNLOCK_PROMPT = "Enter your session passphrase to unlock API keys:";

export interface PassphraseService {
  /** Request a passphrase from the user via in-app modal. Resolves null if cancelled. */
  requestPassphrase(prompt: string): Promise<string | null>;
  /** Resolve the pending request. Called by the modal component. */
  resolvePassphrase(value: string | null): void;
  /** Read the cached non-extractable session key, or null if locked. */
  getSessionKey(): CryptoKey | null;
  /**
   * Derive (and cache) the session key from a passphrase, running the v1→v2
   * migration sweep. The raw passphrase is consumed here and never stored.
   */
  setSessionKeyFromPassphrase(passphrase: string): Promise<CryptoKey>;
  /** Drop the cached session key ("lock"). */
  clearSessionKey(): void;
  /** True while a session key is cached. */
  isUnlocked(): boolean;
}

let _service: PassphraseService | null = null;

/**
 * Wire the live service implementation. Called by <PassphraseProvider> on mount
 * and cleared on unmount. Tests can inject a stub here.
 */
export function setPassphraseService(service: PassphraseService | null): void {
  _service = service;
}

function service(): PassphraseService {
  if (!_service)
    throw new Error("Passphrase service is not available — is the app wrapped in <PassphraseProvider>?");
  return _service;
}

export const requestPassphrase = (prompt: string): Promise<string | null> => service().requestPassphrase(prompt);
export const resolvePassphrase = (value: string | null): void => service().resolvePassphrase(value);
export const getSessionKey = (): CryptoKey | null => service().getSessionKey();
export const setSessionKeyFromPassphrase = (passphrase: string): Promise<CryptoKey> => service().setSessionKeyFromPassphrase(passphrase);
export const clearSessionKey = (): void => service().clearSessionKey();
export const isUnlocked = (): boolean => service().isUnlocked();

/**
 * Resolve a stored secret blob to plaintext, shared by every key resolver.
 *
 * - Plaintext blobs pass straight through (the no-passphrase / local-token case).
 * - Encrypted blobs require an unlocked session key. If locked, prompts for the
 *   passphrase and derives one — which also migrates any legacy v1 blobs to v2 —
 *   then re-reads `storageKey` so a freshly-migrated v2 blob is used.
 *
 * Returns null only when the user cancels the prompt. Throws WrongPassphraseError
 * (after clearing the cached key) when decryption fails, and lets
 * KeysUnrecoverableError propagate from the unlock step.
 */
export const ENCRYPT_PROMPT = "Set a session passphrase to encrypt your API keys:";

/**
 * Encrypt a secret for storage, shared by every key save path (LLM, local
 * token, TTS, imaging). If the session is locked, prompts for a passphrase and
 * derives the key first — the same gate on every provider key.
 *
 * Returns the enc:v2: bundle, or null when the user cancels the prompt.
 * Callers must leave the stored value untouched on null — never fall back to
 * persisting the plaintext.
 */
export async function encryptForStorage(
  plain: string,
  prompt: string = ENCRYPT_PROMPT,
): Promise<string | null> {
  if (!isUnlocked()) {
    const pass = await requestPassphrase(prompt);
    if (pass == null)
      return null; // cancelled
    await setSessionKeyFromPassphrase(pass);
  }
  const key = getSessionKey();
  if (!key)
    return null;
  return encryptWithKey(key, plain.trim());
}

export async function decryptStored(
  storageKey: string,
  blob: string,
  prompt: string = DEFAULT_UNLOCK_PROMPT,
): Promise<string | null> {
  if (!isEncrypted(blob))
    return blob.trim();
  if (!isUnlocked()) {
    const pass = await requestPassphrase(prompt);
    if (pass == null)
      return null; // cancelled
    await setSessionKeyFromPassphrase(pass); // derives + sweeps v1→v2
    blob = localStorage.getItem(storageKey) ?? blob; // re-read post-migration
  }
  const key = getSessionKey();
  if (!key)
    return null;
  if (!isV2(blob)) {
    // Still a legacy blob while unlocked → it was encrypted under a different
    // passphrase and the sweep couldn't migrate it. Treat as wrong passphrase.
    clearSessionKey();
    throw new WrongPassphraseError();
  }
  try {
    return (await decryptWithKey(key, blob)).trim();
  } catch {
    clearSessionKey();
    throw new WrongPassphraseError();
  }
}
