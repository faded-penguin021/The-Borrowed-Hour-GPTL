// @ts-check

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
  _listener?.();
  return new Promise((resolve) => {
    _pendingResolve = resolve;
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
