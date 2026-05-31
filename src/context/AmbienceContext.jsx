// @ts-check
import React, { createContext, useContext, useMemo } from "react";
import { useAmbience } from "../hooks/useAmbience.js";

const AmbienceContext = createContext(/** @type {any} */ (null));

/**
 * The ambience bed (intensity, mute, music) plus the imperative engine ref.
 * @returns {ReturnType<typeof useAmbience>}
 */
export function useAmbienceContext() {
  return useContext(AmbienceContext);
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
