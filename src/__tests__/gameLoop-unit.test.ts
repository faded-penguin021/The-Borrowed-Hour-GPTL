import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGameLoop, type GameLoopDeps } from "../context/gameLoop";
import { INITIAL_STATE, createStreamingStore, type StoryState } from "../context/storyReducer";
import type { AppSettings } from "../types";
import { DEFAULT_SETTINGS } from "../data/constants";

const OPENING = JSON.stringify({
  gm_scratchpad: "", narration: "You wake in a pale room.",
  state: { scene: "A pale room", time: "Dawn", inventory: [], npcs: [], clues: [], summary: "Begin.", hidden_state: "" },
  ending: null,
});

function makeDeps(overrides: Partial<GameLoopDeps> = {}): GameLoopDeps {
  let state: StoryState = { ...INITIAL_STATE };
  return {
    getState: () => state,
    getSettings: () => DEFAULT_SETTINGS as AppSettings,
    getLoading: () => false,
    dispatch: vi.fn((action) => {
      if (action.type === "RESET") state = { ...INITIAL_STATE };
      if (action.type === "SET_ENTRIES") state = { ...state, entries: action.entries };
      if (action.type === "START_GAME") state = { ...state, phase: "playing", premise: action.premise };
    }),
    setLoading: vi.fn(),
    setLoadingPhrase: vi.fn(),
    resetSessionTokens: vi.fn(),
    abortRef: { current: null },
    streamingStore: createStreamingStore(),
    callAPI: vi.fn(async () => OPENING),
    streamAPI: vi.fn(async () => "narration text"),
    codex: {
      revokeAllPlates: vi.fn(),
      resetCodex: vi.fn(),
      restoreCodex: vi.fn(),
      runArtDirectorBootstrap: vi.fn(async () => {}),
      runArtDirectorTurn: vi.fn(async () => {}),
    },
    saves: {
      setSaveBanner: vi.fn(),
      clearAutosave: vi.fn(),
      setShowSaves: vi.fn(),
      readAutosave: vi.fn(async () => null),
    },
    progress: { recordEnding: vi.fn() },
    tts: { ttsRef: { current: null }, stopTTS: vi.fn(), resetTTSCursor: vi.fn() },
    ambience: { ensureAmbienceEngine: vi.fn(async () => null), ambienceRef: { current: null } },
    reveal: { resetReveal: vi.fn() },
    keepsake: { resetKeepsake: vi.fn() },
    ...overrides,
  };
}

describe("createGameLoop", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("cancelRequest", () => {
    it("aborts the controller and runs rollback", () => {
      const deps = makeDeps();
      const loop = createGameLoop(deps);
      const rollback = vi.fn();
      const controller = new AbortController();
      deps.abortRef.current = { controller, rollback, startedAt: Date.now() };
      loop.cancelRequest();
      expect(controller.signal.aborted).toBe(true);
      expect(rollback).toHaveBeenCalled();
      expect(deps.setLoading).toHaveBeenCalledWith(false);
      expect(deps.abortRef.current).toBeNull();
    });

    it("is a no-op when no request is in flight", () => {
      const deps = makeDeps();
      const loop = createGameLoop(deps);
      loop.cancelRequest();
      expect(deps.setLoading).not.toHaveBeenCalled();
    });
  });

  describe("undoLastTurn", () => {
    it("dispatches UNDO when conditions are met", () => {
      const entries = [
        { type: "narration" as const, text: "opening", fullyRevealed: true },
        { type: "action" as const, text: "go north", fullyRevealed: true },
        { type: "narration" as const, text: "door opens", fullyRevealed: true },
      ];
      const history = [
        { role: "user" as const, content: "Begin." },
        { role: "assistant" as const, content: OPENING },
        { role: "user" as const, content: "[Player action]\ngo north" },
        { role: "assistant" as const, content: OPENING },
      ];
      const deps = makeDeps();
      (deps as { getState: () => StoryState }).getState = () => ({
        ...INITIAL_STATE,
        phase: "playing",
        entries,
        history,
        metaMode: false,
      });
      const loop = createGameLoop(deps);
      loop.undoLastTurn();
      expect(deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "UNDO" }));
      expect(deps.saves.setSaveBanner).toHaveBeenCalled();
    });

    it("does nothing when history is too short", () => {
      const deps = makeDeps();
      const loop = createGameLoop(deps);
      loop.undoLastTurn();
      expect(deps.dispatch).not.toHaveBeenCalled();
    });
  });

  describe("restart", () => {
    it("dispatches RESET and resets domain hooks", () => {
      const deps = makeDeps();
      const loop = createGameLoop(deps);
      loop.restart();
      expect(deps.dispatch).toHaveBeenCalledWith({ type: "RESET" });
      expect(deps.codex.resetCodex).toHaveBeenCalled();
      expect(deps.reveal.resetReveal).toHaveBeenCalled();
      expect(deps.keepsake.resetKeepsake).toHaveBeenCalled();
      expect(deps.tts.stopTTS).toHaveBeenCalled();
      expect(deps.tts.resetTTSCursor).toHaveBeenCalledWith(0);
      expect(deps.resetSessionTokens).toHaveBeenCalled();
    });
  });

  describe("resumeAutosave", () => {
    it("shows error banner when no autosave exists", async () => {
      const deps = makeDeps();
      const loop = createGameLoop(deps);
      await loop.resumeAutosave();
      expect(deps.saves.setSaveBanner).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "err" })
      );
    });
  });
});
