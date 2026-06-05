/* eslint-disable react-refresh/only-export-components -- provider co-located with its context hook(s); splitting churns every import site for a dev-only Fast Refresh gain */
import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { setPassphraseService, KeysUnrecoverableError } from "../passphrase";
import {
  deriveSessionKey,
  migrateV1Blobs,
  hasKdfSalt,
  hasEncryptedV2Blobs,
} from "../storage/encryption";
import { createAutoLock } from "../security/autoLock";

interface PassphraseContextValue {
  /** The prompt for the currently pending request, or null when idle. */
  prompt: string | null;
  /** True while a passphrase request is awaiting the user. */
  pending: boolean;
  /** True while a session key is cached (reactive — drives the lock-status UI). */
  unlocked: boolean;
  requestPassphrase(prompt: string): Promise<string | null>;
  resolvePassphrase(value: string | null): void;
  getSessionKey(): CryptoKey | null;
  setSessionKeyFromPassphrase(passphrase: string): Promise<CryptoKey>;
  clearSessionKey(): void;
  isUnlocked(): boolean;
}

const PassphraseContext = createContext<PassphraseContextValue | null>(null);

/**
 * Access the passphrase context. Throws if used outside <PassphraseProvider>.
 */
export function usePassphrase(): PassphraseContextValue {
  const ctx = useContext(PassphraseContext);
  if (!ctx) throw new Error("usePassphrase must be used within a <PassphraseProvider>");
  return ctx;
}

/**
 * Owns the session key and the single in-flight passphrase request.
 *
 * What lives where: the non-extractable session `CryptoKey` and the pending
 * resolver live in refs (React-owned, not on `window`); the prompt text, a
 * pending flag, and a reactive `unlocked` boolean live in state so the modal and
 * the lock-status row render reactively. On mount the provider registers its
 * operations with the passphrase service boundary so non-React key resolvers
 * (LLM/TTS/image) can reach them, and starts the auto-lock controller.
 *
 * Security: only a non-extractable `CryptoKey` is retained for the session — the
 * raw passphrase is consumed at unlock and dropped. That key can't be exported as
 * bytes even by in-page script, though such script can still use it to decrypt
 * while unlocked. See THREAT_MODEL.md.
 */
export function PassphraseProvider({ children }: { children: React.ReactNode }) {
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const pendingResolveRef = useRef<((value: string | null) => void) | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const getSessionKey = useCallback(() => sessionKeyRef.current, []);
  const isUnlocked = useCallback(() => sessionKeyRef.current !== null, []);

  const clearSessionKey = useCallback(() => {
    sessionKeyRef.current = null;
    setUnlocked(false);
  }, []);

  const setSessionKeyFromPassphrase = useCallback(async (passphrase: string): Promise<CryptoKey> => {
    // Guard the data-loss case before touching the salt: if v2 ciphertext exists
    // but its salt is gone, deriving any key (which would mint a *fresh* salt)
    // can never decrypt those blobs. Fail loud instead of looping the prompt.
    if (!hasKdfSalt() && hasEncryptedV2Blobs())
      throw new KeysUnrecoverableError();
    const key = await deriveSessionKey(passphrase); // creates+persists the salt on first set
    // Migrate while the passphrase is still on the stack; afterwards only the key is held.
    await migrateV1Blobs(passphrase, key);
    sessionKeyRef.current = key;
    setUnlocked(true);
    return key;
  }, []);

  const requestPassphrase = useCallback((p: string): Promise<string | null> => {
    // A second request while one is pending resolves to null rather than
    // clobbering the in-flight resolver (matches the previous behavior).
    if (pendingResolveRef.current) return Promise.resolve(null);
    setPrompt(p);
    setPending(true);
    return new Promise<string | null>((resolve) => {
      pendingResolveRef.current = resolve;
    });
  }, []);

  const resolvePassphrase = useCallback((value: string | null) => {
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    setPending(false);
    setPrompt(null);
    resolve?.(value);
  }, []);

  useEffect(() => {
    setPassphraseService({
      requestPassphrase,
      resolvePassphrase,
      getSessionKey,
      setSessionKeyFromPassphrase,
      clearSessionKey,
      isUnlocked,
    });
    return () => setPassphraseService(null);
  }, [requestPassphrase, resolvePassphrase, getSessionKey, setSessionKeyFromPassphrase, clearSessionKey, isUnlocked]);

  // Auto-lock: drop the cached key when the tab is backgrounded past a short
  // grace, never on an in-tab idle timer (a reader can dwell on a passage for
  // minutes). See src/security/autoLock.ts.
  useEffect(() => {
    const controller = createAutoLock({ lock: clearSessionKey, isUnlocked });
    controller.start();
    return () => controller.stop();
  }, [clearSessionKey, isUnlocked]);

  const value = useMemo<PassphraseContextValue>(() => ({
    prompt,
    pending,
    unlocked,
    requestPassphrase,
    resolvePassphrase,
    getSessionKey,
    setSessionKeyFromPassphrase,
    clearSessionKey,
    isUnlocked,
  }), [prompt, pending, unlocked, requestPassphrase, resolvePassphrase, getSessionKey, setSessionKeyFromPassphrase, clearSessionKey, isUnlocked]);

  return <PassphraseContext.Provider value={value}>{children}</PassphraseContext.Provider>;
}
