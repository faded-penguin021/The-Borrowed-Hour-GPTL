// @ts-check
import { useState, useEffect, useCallback } from "react";

const ENDINGS_KEY = "borrowed:endings:v1";
const ALL_ENDINGS = ["good", "bittersweet", "pyrrhic", "ambiguous", "bad"];

/**
 * Tracks which of the five ending types the player has discovered.
 * Reads localStorage exactly once on mount and caches in React state.
 * Never reads storage during render, preventing micro-stutters in .map() loops.
 * @returns {{ discoveredEndings: string[], recordEnding: (ending: string | null | undefined) => void }}
 */
export function useProgress() {
  const [discoveredEndings, setDiscoveredEndings] = useState(/** @type {string[]} */ ([]));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENDINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDiscoveredEndings(parsed.filter((e) => ALL_ENDINGS.includes(e)));
        }
      }
    } catch {}
  }, []);

  const recordEnding = useCallback((/** @type {string | null | undefined} */ ending) => {
    if (!ending || !ALL_ENDINGS.includes(ending)) return;
    setDiscoveredEndings((prev) => {
      if (prev.includes(ending)) return prev;
      const next = [...prev, ending];
      try {
        localStorage.setItem(ENDINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { discoveredEndings, recordEnding };
}
