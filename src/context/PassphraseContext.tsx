/* eslint-disable react-refresh/only-export-components -- provider co-located with its context hook(s); splitting churns every import site for a dev-only Fast Refresh gain */
import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { setPassphraseService } from "../passphrase";

interface PassphraseContextValue {
  /** The prompt for the currently pending request, or null when idle. */
  prompt: string | null;
  /** True while a passphrase request is awaiting the user. */
  pending: boolean;
  requestPassphrase(prompt: string): Promise<string | null>;
  resolvePassphrase(value: string | null): void;
  getSessionPassphrase(): string | null;
  setSessionPassphrase(value: string | null): void;
  clearSessionPassphrase(): void;
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
 * Owns the session passphrase and the single in-flight passphrase request.
 *
 * The secret and the pending resolver live in refs (React-owned, not on
 * `window` and not in module globals); the prompt text and a pending flag live
 * in state so the modal can render reactively. On mount the provider registers
 * its operations with the passphrase service boundary so non-React key
 * resolvers (LLM/TTS) can reach them; it clears the registration on unmount.
 *
 * This is a lifecycle/testability cleanup, not a security change — the secret
 * remains in ordinary browser memory with the same exposure as before.
 */
export function PassphraseProvider({ children }: { children: React.ReactNode }) {
  const passphraseRef = useRef<string | null>(null);
  const pendingResolveRef = useRef<((value: string | null) => void) | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const getSessionPassphrase = useCallback(() => passphraseRef.current, []);
  const setSessionPassphrase = useCallback((value: string | null) => {
    passphraseRef.current = value || null;
  }, []);
  const clearSessionPassphrase = useCallback(() => {
    passphraseRef.current = null;
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
      getSessionPassphrase,
      setSessionPassphrase,
      clearSessionPassphrase,
    });
    return () => setPassphraseService(null);
  }, [requestPassphrase, resolvePassphrase, getSessionPassphrase, setSessionPassphrase, clearSessionPassphrase]);

  const value = useMemo<PassphraseContextValue>(() => ({
    prompt,
    pending,
    requestPassphrase,
    resolvePassphrase,
    getSessionPassphrase,
    setSessionPassphrase,
    clearSessionPassphrase,
  }), [prompt, pending, requestPassphrase, resolvePassphrase, getSessionPassphrase, setSessionPassphrase, clearSessionPassphrase]);

  return <PassphraseContext.Provider value={value}>{children}</PassphraseContext.Provider>;
}
