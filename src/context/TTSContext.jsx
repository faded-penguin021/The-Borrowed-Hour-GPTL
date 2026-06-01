// @ts-check
/**
 * @import { Provider } from "../types"
 */
import React, { createContext, useContext, useEffect } from "react";
import { useTTS } from "../hooks/useTTS.js";
import { useAmbienceContext } from "./AmbienceContext.jsx";

/** @type {React.Context<ReturnType<typeof useTTS> | null>} */
const TTSContext = createContext(/** @type {ReturnType<typeof useTTS> | null} */ (null));

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
 *
 * @param {{ showSettings: boolean, children: React.ReactNode }} props
 */
export function TTSProvider({ showSettings, children }) {
  const tts = useTTS({ showSettings });
  const ambience = useAmbienceContext();

  const { ambienceRef, ambienceEngineNonce, ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceLevel } = ambience;

  // Gate the ambience bed to narration only while TTS is on.
  useEffect(() => {
    ambienceRef.current?.setSpeechGate(ambienceDuringNarrationOnly && tts.ttsEnabled);
  }, [ambienceDuringNarrationOnly, tts.ttsEnabled, ambienceEngineNonce]);

  // Boost (duck) the bed under spoken narration when requested.
  useEffect(() => {
    ambienceRef.current?.setBoost(ambienceBoostWithTTS && tts.ttsEnabled);
  }, [ambienceBoostWithTTS, tts.ttsEnabled, ambienceEngineNonce]);

  // Wire the speak start/end callbacks so the engine can react to narration.
  useEffect(() => {
    const ctrl = tts.ttsRef.current;
    const eng = ambienceRef.current;
    if (!ctrl || !eng) return;
    const u1 = ctrl.onSpeakStart(() => eng.notifySpeechStart());
    const u2 = ctrl.onSpeakEnd(() => eng.notifySpeechEnd());
    return () => { u1(); u2(); };
  }, [tts.ttsEnabled, ambienceLevel, ambienceEngineNonce]);

  // The hook returns a fresh object each render; pass it straight through so no
  // consumer ever reads a stale field. (Per-field memoization is intentionally
  // avoided here to prevent omitting a field from the dependency list.)
  return <TTSContext.Provider value={tts}>{children}</TTSContext.Provider>;
}
