import React, { createContext, useContext, useMemo } from "react";
import { useAmbience } from "../hooks/useAmbience";

type AmbienceValue = ReturnType<typeof useAmbience>;

const AmbienceContext = createContext<AmbienceValue | null>(null);

/**
 * The ambience bed (intensity, mute, music) plus the imperative engine ref.
 * Throws if used outside an <AmbienceProvider>.
 */
export function useAmbienceContext() {
  const ctx = useContext(AmbienceContext);
  if (!ctx) throw new Error("useAmbienceContext must be used within an <AmbienceProvider>");
  return ctx;
}

export function AmbienceProvider({ children }: { children: React.ReactNode }) {
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
