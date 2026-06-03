import type { ChatMessage, Entry, GameState, MetaMessage, NarrationEntry, Premise } from "../types";
import { EMPTY_STATE } from "../data/constants";
import { DEFAULT_LANGUAGE } from "../data/languages";

export interface Recovery {
  narratorSys: string;
  narratorPrompt: string;
  gmParsed: RecoveryGMParsed;
  baseEntries: Entry[];
  baseHistory: ChatMessage[];
  partial: string;
}

export type RecoveryGMParsed = {
  state?: GameState | null;
  ending?: string | null;
  narration?: string;
  narrator_brief?: string;
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
  language: string;
  metaMode: boolean;
  metaMessages: MetaMessage[];
  skipNonce: number;
  recovery: Recovery | null;
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
  language: DEFAULT_LANGUAGE,
  metaMode: false,
  metaMessages: [],
  skipNonce: 0,
  recovery: null,
};

export type StoryAction =
  | { type: "START_GAME"; premise: Premise }
  | { type: "SET_PHASE"; phase: string }
  | { type: "SET_PREMISE"; premise: Premise | null }
  | { type: "SET_ENTRIES"; entries: Entry[] }
  | { type: "UPDATE_ENTRIES"; updater: (prev: Entry[]) => Entry[] }
  | { type: "SET_HISTORY"; history: ChatMessage[] }
  | { type: "SET_GAME_STATE"; gameState: GameState }
  | { type: "SET_ERROR"; error: StoryState["error"] }
  | { type: "SET_RECOVERY"; recovery: Recovery | null }
  | { type: "SET_ENDED"; ended: boolean }
  | { type: "SET_LANGUAGE"; language: string }
  | { type: "SET_META_MODE"; metaMode: boolean }
  | { type: "SET_META_MESSAGES"; metaMessages: MetaMessage[] }
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
      currentGameState?: GameState;
    }
  | {
      type: "UNDO";
      entries: Entry[];
      history: ChatMessage[];
      gameState: GameState;
    }
  | { type: "LOAD_SAVE"; payload: LoadSavePayload }
  | { type: "RESET" };

export interface LoadSavePayload {
  premise: Premise;
  entries: Entry[];
  history: ChatMessage[];
  ended: boolean;
  gameState: GameState;
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
      if (
        action.gameState != null &&
        action.currentGameState !== undefined
      ) {
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
        ended: false,
        error: null,
        recovery: null,
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
        language: action.payload.language,
        metaMessages: action.payload.metaMessages,
        metaMode: action.payload.metaMode,
      };

    case "RESET":
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}
