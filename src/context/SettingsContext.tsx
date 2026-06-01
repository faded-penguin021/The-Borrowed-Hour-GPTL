import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { AppSettings } from "../types";
import { useSettings } from "../hooks/useSettings";

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: (key: string, value: unknown) => void;
  osReducedMotion: boolean;
  instantReveal: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Reading/display preferences, owned by a single provider so the settings modal
 * and the screens read them straight from context instead of a prop chain.
 * Throws if used outside a <SettingsProvider>.
 */
export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within a <SettingsProvider>");
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSetting } = useSettings();

  const [osReducedMotion, setOsReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const instantReveal = settings.disableTypewriter || osReducedMotion;

  const value = useMemo(
    () => ({ settings, updateSetting, osReducedMotion, instantReveal }),
    [settings, updateSetting, osReducedMotion, instantReveal]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
