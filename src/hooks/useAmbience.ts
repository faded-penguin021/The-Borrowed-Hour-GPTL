import { useState, useRef, useEffect } from "react";
import type { AmbienceEngine } from "../ambience/engine";

export function useAmbience() {
  const [ambienceLevel, setAmbienceLevel] = useState("off");
  const [ambienceMuted, setAmbienceMuted] = useState(false);
  const [ambienceUnavailable, setAmbienceUnavailable] = useState(false);
  const [ambienceDuringNarrationOnly, setAmbienceDuringNarrationOnly] = useState(false);
  const [ambienceBoostWithTTS, setAmbienceBoostWithTTS] = useState(false);
  const [ambienceMusicLevel, setAmbienceMusicLevel] = useState("full");
  const loadedRef = useRef(false);
  const ambienceRef = useRef<AmbienceEngine | null>(null);
  const [ambienceEngineNonce, setAmbienceEngineNonce] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("borrowed:ambience:v1");
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          if (parsed && typeof parsed === "object") {
            if (parsed.level === "subtle" || parsed.level === "present" || parsed.level === "off")
              setAmbienceLevel(parsed.level);
            if (typeof parsed.muted === "boolean")
              setAmbienceMuted(parsed.muted);
            if (typeof parsed.duringNarrationOnly === "boolean")
              setAmbienceDuringNarrationOnly(parsed.duringNarrationOnly);
            if (typeof parsed.boostWithTTS === "boolean")
              setAmbienceBoostWithTTS(parsed.boostWithTTS);
            if (parsed.musicLevel === "off" || parsed.musicLevel === "sparse" || parsed.musicLevel === "full")
              setAmbienceMusicLevel(parsed.musicLevel);
          }
        }
      } catch {} finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    (async () => {
      try {
        await window.storage.set("borrowed:ambience:v1", JSON.stringify({
          level: ambienceLevel,
          muted: ambienceMuted,
          duringNarrationOnly: ambienceDuringNarrationOnly,
          boostWithTTS: ambienceBoostWithTTS,
          musicLevel: ambienceMusicLevel
        }));
      } catch {}
    })();
  }, [ambienceLevel, ambienceMuted, ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceMusicLevel]);

  const ensureAmbienceEngine = async (): Promise<AmbienceEngine | null> => {
    if (ambienceLevel === "off") return null;
    if (ambienceUnavailable) return null;
    if (!ambienceRef.current) {
      try {
        const { AmbienceEngine } = await import("../ambience/engine");
        ambienceRef.current = new AmbienceEngine();
        setAmbienceEngineNonce((n) => n + 1);
      } catch (e) {
        setAmbienceUnavailable(true);
        if (typeof console !== "undefined" && console.warn)
          console.warn("[borrowed] Ambience unavailable:", e);
        return null;
      }
    }
    const eng = ambienceRef.current;
    if (!eng) return null;
    if (eng.intensity !== ambienceLevel) eng.setIntensity(ambienceLevel as "off" | "subtle" | "present");
    if (eng.muted !== ambienceMuted) eng.mute(ambienceMuted);
    if (eng.musicLevel !== ambienceMusicLevel) eng.setMusicLevel(ambienceMusicLevel as "off" | "sparse" | "full");
    return eng;
  };

  useEffect(() => {
    const eng = ambienceRef.current;
    if (eng) {
      if (eng.intensity !== ambienceLevel) eng.setIntensity(ambienceLevel as "off" | "subtle" | "present");
      return;
    }
  }, [ambienceLevel]);

  useEffect(() => {
    const eng = ambienceRef.current;
    if (!eng) return;
    if (eng.muted !== ambienceMuted) eng.mute(ambienceMuted);
  }, [ambienceMuted]);

  useEffect(() => {
    const eng = ambienceRef.current;
    if (!eng) return;
    if (eng.musicLevel !== ambienceMusicLevel) eng.setMusicLevel(ambienceMusicLevel as "off" | "sparse" | "full");
  }, [ambienceMusicLevel]);

  // Audio autoplay unlock.
  useEffect(() => {
    const tryResume = () => {
      const eng = ambienceRef.current;
      if (eng && typeof eng.resume === "function") eng.resume();
    };
    const opts = { capture: true, passive: true };
    document.addEventListener("pointerdown", tryResume, opts);
    document.addEventListener("touchend", tryResume, opts);
    document.addEventListener("keydown", tryResume, opts);
    return () => {
      document.removeEventListener("pointerdown", tryResume, opts);
      document.removeEventListener("touchend", tryResume, opts);
      document.removeEventListener("keydown", tryResume, opts);
    };
  }, []);

  return {
    ambienceLevel,
    ambienceMuted,
    ambienceUnavailable,
    ambienceDuringNarrationOnly,
    ambienceBoostWithTTS,
    ambienceMusicLevel,
    ambienceRef,
    ambienceEngineNonce,
    setAmbienceLevel,
    setAmbienceMuted,
    setAmbienceDuringNarrationOnly,
    setAmbienceBoostWithTTS,
    setAmbienceMusicLevel,
    ensureAmbienceEngine,
  };
}
