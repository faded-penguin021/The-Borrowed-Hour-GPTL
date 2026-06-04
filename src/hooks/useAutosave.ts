import { useEffect } from "react";
import type { SaveCurrentArgs } from "./useSaves";

/**
 * The live slice the autosave slot mirrors. It is exactly the persisted
 * `SaveCurrentArgs` plus the two gating flags that decide *when* a turn has come
 * to rest.
 */
export interface AutosaveSlice extends SaveCurrentArgs {
  phase: string;
  loading: boolean;
}

/**
 * Persist the live session into the single autosave slot after every settled
 * turn. The slot's read/write/clear logic lives in `useSaves` (the saves
 * domain); this hook only owns the *trigger*, kept out of the game provider so
 * the loop stays lean — mirroring the other turn-driven side effects there.
 *
 * It fires once a turn rests (playing, not mid-request) and there is something
 * to keep. The opening's empty-entries window and every in-flight delta are
 * skipped, so a normal turn produces a single write when it finalizes. Reveal /
 * illustration arrivals settle into the same slot harmlessly.
 */
export function useAutosave(slice: AutosaveSlice, write: (args: SaveCurrentArgs) => void): void {
  const { phase, loading, premise, entries } = slice;
  useEffect(() => {
    if (phase !== "playing" || loading) return;
    if (!premise || entries.length === 0) return;
    write(slice);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per settled turn; `slice`/`write` are rebuilt each render and read at call time to avoid a stale snapshot
  }, [
    phase, loading, premise, entries,
    slice.history, slice.ended, slice.gameState,
    slice.metaMessages, slice.metaMode, slice.language, slice.codex,
  ]);
}
