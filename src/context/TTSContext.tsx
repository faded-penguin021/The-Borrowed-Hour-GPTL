/* eslint-disable react-refresh/only-export-components -- provider co-located with its context hook(s); splitting churns every import site for a dev-only Fast Refresh gain */
import React, { createContext, useContext, useEffect } from "react";
import { useTTS } from "../hooks/useTTS";
import { useAmbienceContext } from "./AmbienceContext";

type TTSValue = ReturnType<typeof useTTS>;

const TTSContext = createContext<TTSValue | null>(null);

/**
 * Narration-aloud (text-to-speech) state and controls.
 * Throws if used outside a <TTSProvider>.
 */
export function useTTSContext() {
  const ctx = useContext(TTSContext);
  if (!ctx) throw new Error("useTTSContext must be used within a <TTSProvider>");
  return ctx;
}

/**
 * Owns the TTS hook and the ambience↔TTS coupling (speech gating, ducking, and
 * speak start/end notifications). `showSettings` is passed in only to drive the
 * "detect ready providers when the sheet opens" effect inside `useTTS`; it is
 * deliberately NOT exposed on the context value.
 */
export function TTSProvider({ showSettings, children }: { showSettings: boolean; children: React.ReactNode }) {
  const tts = useTTS({ showSettings });
  const ambience = useAmbienceContext();

  const { ambienceRef, ambienceEngineNonce, ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceLevel } = ambience;

  // Gate the ambience bed to narration only while TTS is on.
  useEffect(() => {
    ambienceRef.current?.setSpeechGate(ambienceDuringNarrationOnly && tts.ttsEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ambienceRef is a stable ref deliberately excluded; re-run keyed on the gate inputs + engine nonce
  }, [ambienceDuringNarrationOnly, tts.ttsEnabled, ambienceEngineNonce]);

  // Boost (duck) the bed under spoken narration when requested.
  useEffect(() => {
    ambienceRef.current?.setBoost(ambienceBoostWithTTS && tts.ttsEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ambienceRef is a stable ref deliberately excluded; re-run keyed on the boost inputs + engine nonce
  }, [ambienceBoostWithTTS, tts.ttsEnabled, ambienceEngineNonce]);

  // Wire the speak start/end callbacks so the engine can react to narration.
  useEffect(() => {
    const ctrl = tts.ttsRef.current;
    const eng = ambienceRef.current;
    if (!ctrl || !eng) return;
    const u1 = ctrl.onSpeakStart(() => eng.notifySpeechStart());
    const u2 = ctrl.onSpeakEnd(() => eng.notifySpeechEnd());
    return () => { u1(); u2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ambienceRef/tts.ttsRef are stable refs deliberately excluded; re-wire keyed on enable/level + engine nonce
  }, [tts.ttsEnabled, ambienceLevel, ambienceEngineNonce]);

  // The hook returns a fresh object each render; pass it straight through so no
  // consumer ever reads a stale field. (Per-field memoization is intentionally
  // avoided here to prevent omitting a field from the dependency list.)
  return <TTSContext.Provider value={tts}>{children}</TTSContext.Provider>;
}
