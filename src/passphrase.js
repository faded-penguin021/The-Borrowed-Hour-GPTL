// @ts-check

// Closure-scoped session passphrase. Held in module-private state rather than on
// `window.__sessionPassphrase`, so a stray in-page script can't trivially scrape
// it off the global object. This is NOT a guarantee against a determined
// in-page attacker (the secret is still in memory and reachable by code that can
// import this module), but it removes the cheapest XSS exfiltration vector and
// gives the secret a single owner.
/** @type {string | null} */
let _sessionPassphrase = null;

/** @param {string | null} value */
export function setSessionPassphrase(value) {
  _sessionPassphrase = value || null;
}

/** @returns {string | null} */
export function getSessionPassphrase() {
  return _sessionPassphrase;
}

export function clearSessionPassphrase() {
  _sessionPassphrase = null;
}

/** @type {((value: string | null) => void) | null} */
let _pendingResolve = null;

/** @type {string | null} */
let _pendingPrompt = null;

/** @type {(() => void) | null} */
let _listener = null;

/**
 * Request a passphrase from the user via in-app modal.
 * Returns null if the user cancels.
 * @param {string} prompt
 * @returns {Promise<string | null>}
 */
export function requestPassphrase(prompt) {
  if (_pendingResolve) return Promise.resolve(null);
  _pendingPrompt = prompt;
  return new Promise((resolve) => {
    _pendingResolve = resolve;
    _listener?.();
  });
}

/** Resolve the pending request. Called by the modal component. */
export function resolvePassphrase(/** @type {string | null} */ value) {
  const r = _pendingResolve;
  _pendingResolve = null;
  _pendingPrompt = null;
  _listener?.();
  r?.(value);
}

/** @returns {{ prompt: string | null, pending: boolean }} */
export function getPassphraseState() {
  return { prompt: _pendingPrompt, pending: !!_pendingResolve };
}

/** Subscribe to state changes. Returns unsubscribe function. */
export function onPassphraseChange(/** @type {() => void} */ fn) {
  _listener = fn;
  return () => { if (_listener === fn) _listener = null; };
}
