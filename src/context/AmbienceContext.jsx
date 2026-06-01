// @ts-check
/**
 * @import { Provider } from "../types"
 */
import React, { createContext, useContext, useMemo } from "react";
import { useAmbience } from "../hooks/useAmbience.js";

/** @type {React.Context<ReturnType<typeof useAmbience> | null>} */
const AmbienceContext = createContext(/** @type {ReturnType<typeof useAmbience> | null} */ (null));

/**
 * The ambience bed (intensity, mute, music) plus the imperative engine ref.
 * Throws if used outside an <AmbienceProvider>.
 */
export function useAmbienceContext() {
  const ctx = useContext(AmbienceContext);
  if (!ctx) throw new Error("useAmbienceContext must be used within an <AmbienceProvider>");
  return ctx;
}

/** @param {{ children: React.ReactNode }} props */
export function AmbienceProvider({ children }) {
  const ambience = useAmbience();

  const value = useMemo(
    () => ambience,
    [
      ambience.ambienceLevel,
      ambience.ambienceMuted,
      ambience.ambienceUnavailable,
      ambience.ambienceDuringNarrationOnly,
      ambience.ambienceBoostWithTTS,
      ambience.ambienceMusicLevel,
      ambience.ambienceEngineNonce,
    ]
  );

  return <AmbienceContext.Provider value={value}>{children}</AmbienceContext.Provider>;
}
