// Closure-scoped session passphrase. Held in module-private state rather than on
// `window.__sessionPassphrase`, so a stray in-page script can't trivially scrape
// it off the global object. This is NOT a guarantee against a determined
// in-page attacker (the secret is still in memory and reachable by code that can
// import this module), but it removes the cheapest XSS exfiltration vector and
// gives the secret a single owner.
let _sessionPassphrase: string | null = null;

export function setSessionPassphrase(value: string | null): void {
  _sessionPassphrase = value || null;
}

export function getSessionPassphrase(): string | null {
  return _sessionPassphrase;
}

export function clearSessionPassphrase(): void {
  _sessionPassphrase = null;
}

let _pendingResolve: ((value: string | null) => void) | null = null;

let _pendingPrompt: string | null = null;

let _listener: (() => void) | null = null;

/**
 * Request a passphrase from the user via in-app modal.
 * Returns null if the user cancels.
 */
export function requestPassphrase(prompt: string): Promise<string | null> {
  if (_pendingResolve) return Promise.resolve(null);
  _pendingPrompt = prompt;
  return new Promise((resolve) => {
    _pendingResolve = resolve;
    _listener?.();
  });
}

/** Resolve the pending request. Called by the modal component. */
export function resolvePassphrase(value: string | null): void {
  const r = _pendingResolve;
  _pendingResolve = null;
  _pendingPrompt = null;
  _listener?.();
  r?.(value);
}

export function getPassphraseState(): { prompt: string | null; pending: boolean } {
  return { prompt: _pendingPrompt, pending: !!_pendingResolve };
}

/** Subscribe to state changes. Returns unsubscribe function. */
export function onPassphraseChange(fn: () => void): () => void {
  _listener = fn;
  return () => {
    if (_listener === fn) _listener = null;
  };
}
