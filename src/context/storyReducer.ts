import type { ChatMessage, ContinuityFinding, Entry, GameState, LedgerRowInput, MetaMessage, NarrationEntry, Premise, StoryLedger } from "../types";
import { EMPTY_LEDGER, EMPTY_STATE } from "../data/constants";
import { appendLedgerRows, truncateLedgerToTurn } from "./storyLedger";
import { DEFAULT_LANGUAGE } from "../data/languages";

export interface Recovery {
  narratorSys: string;
  narratorPrompt: string;
  gmParsed: RecoveryGMParsed;
  baseEntries: Entry[];
  baseHistory: ChatMessage[];
  partial: string;
  // The state and ledger as they stood before the interrupted turn. Carried so
  // the resumed finalize diffs against the same baseline the first one did --
  // by then the store holds the turn's own state, which would diff clean.
  baseState: GameState;
  baseLedger: StoryLedger;
}

export type RecoveryGMParsed = {
  state?: GameState | null;
  ending?: string | null;
  narration?: string;
  narrator_brief?: string;
  // Carried so a resumed narration appends the same rows the interrupted turn
  // proposed. Re-appending them is safe -- appendLedgerRows drops a duplicate
  // of a row already held -- and dropping them would lose the turn's facts.
  story_ledger_append?: LedgerRowInput[];
};

export type FormattedError = { message: string; detail: string | null; raw: unknown };

export interface StoryState {
  phase: string;
  premise: Premise | null;
  entries: Entry[];
  history: ChatMessage[];
  error: FormattedError | null;
  ended: boolean;
  gameState: GameState;
  // Permanent memory. gameState above is rewritten every turn; this is not.
  ledger: StoryLedger;
  // What the continuity rules said about the LAST turn. Replaced each turn,
  // never accumulated: a finding describes one transition, so carrying it
  // forward would keep reporting a drift the next turn may already have fixed.
  // Deliberately not persisted -- see SaveRecord, which does not carry it.
  // Read today only by `dlog`; it is the slice a findings surface will read.
  continuity: ContinuityFinding[];
  language: string;
  metaMode: boolean;
  metaMessages: MetaMessage[];
  skipNonce: number;
  recovery: Recovery | null;
  frozenPrefixLength: number;
  prunedPrefixLength: number;
}

// ── Streaming store ────────────────────────────────────────────────────────
// A tiny external store for streaming narration text. Components subscribe
// via useSyncExternalStore; the onDelta callback writes here instead of
// dispatching per-token state updates.

export interface StreamingStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => string;
  emit: (text: string) => void;
  reset: () => void;
}

export function createStreamingStore(): StreamingStore {
  let text = "";
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot() { return text; },
    emit(newText) {
      text = newText;
      for (const l of listeners) l();
    },
    reset() { text = ""; },
  };
}

export const INITIAL_STATE: StoryState = {
  phase: "title",
  premise: null,
  entries: [],
  history: [],
  error: null,
  ended: false,
  gameState: EMPTY_STATE,
  ledger: EMPTY_LEDGER,
  continuity: [],
  language: DEFAULT_LANGUAGE,
  metaMode: false,
  metaMessages: [],
  skipNonce: 0,
  recovery: null,
  frozenPrefixLength: 0,
  prunedPrefixLength: 0,
};

export type StoryAction =
  | { type: "START_GAME"; premise: Premise }
  | { type: "SET_PHASE"; phase: string }
  | { type: "SET_PREMISE"; premise: Premise | null }
  | { type: "SET_ENTRIES"; entries: Entry[] }
  | { type: "UPDATE_ENTRIES"; updater: (prev: Entry[]) => Entry[] }
  | { type: "SET_HISTORY"; history: ChatMessage[] }
  | { type: "SET_GAME_STATE"; gameState: GameState }
  // The only ledger action the GM can reach. No edit, no delete, no replace --
  // that absence is what makes the tier append-only, so do not add one. UNDO
  // below is the one path that removes a row, and it is the PLAYER unmaking a
  // turn rather than the GM revising a fact; see truncateLedgerToTurn.
  | { type: "APPEND_LEDGER_ROWS"; turn: number; rows: LedgerRowInput[] }
  // Advisory only. Replaces the previous turn's findings; never appends.
  | { type: "SET_CONTINUITY"; findings: ContinuityFinding[] }
  | { type: "SET_ERROR"; error: StoryState["error"] }
  | { type: "SET_RECOVERY"; recovery: Recovery | null }
  | { type: "SET_ENDED"; ended: boolean }
  | { type: "SET_LANGUAGE"; language: string }
  | { type: "SET_META_MODE"; metaMode: boolean }
  | { type: "SET_META_MESSAGES"; metaMessages: MetaMessage[] }
  | { type: "SET_FROZEN_PREFIX"; length: number }
  | { type: "SET_PRUNED_PREFIX"; length: number }
  | { type: "SKIP_REVEAL" }
  | { type: "ENTER_META" }
  | { type: "EXIT_META" }
  | {
      type: "APPEND_TURN";
      entries: Entry[];
      history: ChatMessage[];
      gameState?: GameState | null;
      ended?: boolean;
    }
  | {
      type: "STREAM_FINALIZE";
      narrationIndex: number;
      text: string;
      fullyRevealed: boolean;
      history: ChatMessage[];
      gameState?: GameState | null;
      ended?: boolean;
    }
  | {
      type: "UNDO";
      entries: Entry[];
      history: ChatMessage[];
      gameState: GameState;
      // The surviving turn count. Ledger rows stamped after it are dropped --
      // the player unmaking a turn, never the GM revising a row.
      turn: number;
    }
  | { type: "LOAD_SAVE"; payload: LoadSavePayload }
  | { type: "RESET" };

export interface LoadSavePayload {
  premise: Premise;
  entries: Entry[];
  history: ChatMessage[];
  ended: boolean;
  gameState: GameState;
  ledger: StoryLedger;
  language: string;
  metaMessages: MetaMessage[];
  metaMode: boolean;
}

export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case "START_GAME":
      return {
        ...INITIAL_STATE,
        premise: action.premise,
        phase: "playing",
        language: state.language,
      };

    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_PREMISE":
      return { ...state, premise: action.premise };

    case "SET_ENTRIES":
      return { ...state, entries: action.entries };

    case "UPDATE_ENTRIES":
      return { ...state, entries: action.updater(state.entries) };

    case "SET_HISTORY":
      return { ...state, history: action.history };

    case "SET_GAME_STATE":
      return { ...state, gameState: action.gameState };

    case "SET_CONTINUITY":
      return { ...state, continuity: action.findings };

    case "APPEND_LEDGER_ROWS":
      return { ...state, ledger: appendLedgerRows(state.ledger, action.turn, action.rows) };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "SET_RECOVERY":
      return { ...state, recovery: action.recovery };

    case "SET_ENDED":
      return { ...state, ended: action.ended };

    case "SET_LANGUAGE":
      return { ...state, language: action.language };

    case "SET_META_MODE":
      return { ...state, metaMode: action.metaMode };

    case "SET_META_MESSAGES":
      return { ...state, metaMessages: action.metaMessages };

    case "SET_FROZEN_PREFIX":
      return { ...state, frozenPrefixLength: action.length };

    case "SET_PRUNED_PREFIX":
      return { ...state, prunedPrefixLength: action.length };

    case "SKIP_REVEAL":
      return { ...state, skipNonce: state.skipNonce + 1 };

    case "ENTER_META":
      return { ...state, metaMode: true, metaMessages: [] };

    case "EXIT_META":
      return { ...state, metaMode: false, metaMessages: [] };

    case "APPEND_TURN": {
      const next: StoryState = {
        ...state,
        entries: action.entries,
        history: action.history,
      };
      if (action.gameState != null) next.gameState = action.gameState;
      if (action.ended) next.ended = true;
      return next;
    }

    case "STREAM_FINALIZE": {
      const entries = state.entries.slice();
      const existing = entries[action.narrationIndex];
      const entry: NarrationEntry = {
        type: "narration",
        text: action.text,
        fullyRevealed: action.fullyRevealed,
      };
      if (existing && existing.illustration) entry.illustration = existing.illustration;
      entries[action.narrationIndex] = entry;

      const next: StoryState = {
        ...state,
        entries,
        history: action.history,
      };
      if (action.gameState != null) {
        next.gameState = action.gameState;
      }
      if (action.ended) next.ended = true;
      return next;
    }

    case "UNDO":
      return {
        ...state,
        entries: action.entries,
        history: action.history,
        gameState: action.gameState,
        ledger: truncateLedgerToTurn(state.ledger, action.turn),
        // The turn they described has been unmade.
        continuity: [],
        ended: false,
        error: null,
        recovery: null,
        frozenPrefixLength: Math.min(state.frozenPrefixLength, action.history.length),
        prunedPrefixLength: Math.min(state.prunedPrefixLength, Math.max(0, action.history.length - 2)),
      };

    case "LOAD_SAVE":
      return {
        ...state,
        phase: "playing",
        premise: action.payload.premise,
        entries: action.payload.entries,
        history: action.payload.history,
        error: null,
        recovery: null,
        ended: action.payload.ended,
        gameState: action.payload.gameState,
        ledger: action.payload.ledger,
        // Not persisted, and stale for the loaded story anyway.
        continuity: [],
        language: action.payload.language,
        metaMessages: action.payload.metaMessages,
        metaMode: action.payload.metaMode,
        frozenPrefixLength: 0,
        prunedPrefixLength: 0,
      };

    case "RESET":
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}
