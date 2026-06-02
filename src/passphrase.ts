// Passphrase service boundary.
//
// The session passphrase, pending prompt, and pending resolver now live in
// React-owned state inside <PassphraseProvider> (see context/PassphraseContext).
// This module no longer holds any of that lifecycle state itself — it is a thin
// injection point so non-React callers (the LLM/TTS key resolvers) can reach the
// provider's operations through a single typed seam instead of a web of
// module-level globals and listeners.
//
// Security note: this is a lifecycle/testability cleanup, not a security
// improvement. The secret is still held in ordinary browser memory and is
// reachable by any code that can call these operations — exactly as before. It
// is not protected against a determined in-page (XSS) attacker; the exposure is
// equivalent to the previous closure-scoped implementation.

export interface PassphraseService {
  /** Request a passphrase from the user via in-app modal. Resolves null if cancelled. */
  requestPassphrase(prompt: string): Promise<string | null>;
  /** Resolve the pending request. Called by the modal component. */
  resolvePassphrase(value: string | null): void;
  /** Read the current session passphrase, or null if none is set. */
  getSessionPassphrase(): string | null;
  /** Set (or clear, with null) the current session passphrase. */
  setSessionPassphrase(value: string | null): void;
  /** Clear the current session passphrase. */
  clearSessionPassphrase(): void;
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
export const getSessionPassphrase = (): string | null => service().getSessionPassphrase();
export const setSessionPassphrase = (value: string | null): void => service().setSessionPassphrase(value);
export const clearSessionPassphrase = (): void => service().clearSessionPassphrase();
