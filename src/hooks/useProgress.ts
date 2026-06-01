import { useState, useEffect, useCallback } from "react";
import type { EndingsByPremise } from "../types";

const ENDINGS_KEY = "borrowed:endings:v2";
const ALL_ENDINGS = ["good", "bittersweet", "pyrrhic", "ambiguous", "bad"];

/** The total number of distinct ending types a single premise can yield. */
export const TOTAL_ENDINGS: number = ALL_ENDINGS.length;

/**
 * Narrow an unknown localStorage payload to the per-premise endings map,
 * discarding anything malformed (including the old v1 flat-array format, which
 * lives under a different key but is guarded against here regardless).
 */
function sanitize(parsed: unknown): EndingsByPremise {
  const clean: EndingsByPremise = {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return clean;
  for (const [premiseId, endings] of Object.entries(parsed)) {
    if (!premiseId || !endings || typeof endings !== "object" || Array.isArray(endings)) continue;
    const kept: Record<string, boolean> = {};
    for (const [ending, flag] of Object.entries(endings)) {
      if (flag === true && ALL_ENDINGS.includes(ending)) kept[ending] = true;
    }
    if (Object.keys(kept).length > 0) clean[premiseId] = kept;
  }
  return clean;
}

interface ProgressHook {
  endingsByPremise: EndingsByPremise;
  recordEnding: (premiseId: string | null | undefined, ending: string | null | undefined) => void;
  getDiscoveredEndings: (premiseId: string | null | undefined) => string[];
}

/**
 * Tracks which of the five ending types the player has discovered, scoped per
 * premise so one hour's progress never bleeds into another's UI.
 * Reads localStorage exactly once on mount and caches in React state.
 * Never reads storage during render, preventing micro-stutters in .map() loops.
 */
export function useProgress(): ProgressHook {
  const [endingsByPremise, setEndingsByPremise] = useState<EndingsByPremise>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENDINGS_KEY);
      if (raw) setEndingsByPremise(sanitize(JSON.parse(raw)));
    } catch {}
  }, []);

  const recordEnding = useCallback((premiseId: string | null | undefined, ending: string | null | undefined) => {
    if (!premiseId || !ending || !ALL_ENDINGS.includes(ending)) return;
    setEndingsByPremise((prev) => {
      if (prev[premiseId]?.[ending]) return prev;
      const next = { ...prev, [premiseId]: { ...prev[premiseId], [ending]: true } };
      try {
        localStorage.setItem(ENDINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const getDiscoveredEndings = useCallback((premiseId: string | null | undefined): string[] => {
    if (!premiseId) return [];
    const found = endingsByPremise[premiseId];
    return found ? Object.keys(found) : [];
  }, [endingsByPremise]);

  return { endingsByPremise, recordEnding, getDiscoveredEndings };
}
