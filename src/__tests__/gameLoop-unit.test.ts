import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGameLoop, type GameLoopDeps } from "../context/gameLoop";
import { INITIAL_STATE, createStreamingStore, type StoryState } from "../context/storyReducer";
import type { AppSettings, Entry, SaveRecord } from "../types";
import { DEFAULT_SETTINGS } from "../data/constants";
import { PREMISES } from "../data/premises";

vi.mock("../storage/imageStore", () => ({ getImage: vi.fn(async () => null) }));

const OPENING = JSON.stringify({
  gm_scratchpad: "", narration: "You wake in a pale room.",
  state: { scene: "A pale room", time: "Dawn", inventory: [], npcs: [], clues: [], summary: "Begin.", hidden_state: "" },
  ending: null,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

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
    ambience: { ensureAmbienceEngine: vi.fn(async () => null), ambienceRef: { current: null }, ambienceEnabled: false },
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

  describe("run latch (one turn at a time)", () => {
    const MID_GAME: StoryState = {
      ...INITIAL_STATE,
      phase: "playing",
      premise: PREMISES[0],
      entries: [
        { type: "narration", text: "opening", fullyRevealed: true },
        { type: "action", text: "go north", fullyRevealed: true },
        { type: "narration", text: "a door", fullyRevealed: true },
      ],
      history: [
        { role: "user", content: "Begin." },
        { role: "assistant", content: OPENING },
        { role: "user", content: "[Player action]\ngo north" },
        { role: "assistant", content: OPENING },
      ],
    };

    it("double-clicking begin starts exactly one adventure", async () => {
      const gate = deferred<string>();
      const deps = makeDeps({ callAPI: vi.fn(() => gate.promise) });
      const loop = createGameLoop(deps);
      const p1 = loop.beginAdventure(PREMISES[0]);
      const p2 = loop.beginAdventure(PREMISES[0]);
      await vi.waitFor(() => expect(deps.callAPI).toHaveBeenCalledTimes(1));
      gate.resolve(OPENING);
      await Promise.all([p1, p2]);
      expect(deps.callAPI).toHaveBeenCalledTimes(1);
      const starts = (deps.dispatch as ReturnType<typeof vi.fn>).mock.calls
        .filter(([a]) => a.type === "START_GAME");
      expect(starts).toHaveLength(1);
    });

    it("a second submit while a turn is in flight is a blocked no-op", async () => {
      const gate = deferred<string>();
      const deps = makeDeps({ callAPI: vi.fn(() => gate.promise), getState: () => MID_GAME });
      const loop = createGameLoop(deps);
      const p1 = loop.submit("go east");
      const blocked = await loop.submit("go west");
      expect(blocked).toBe(true);
      await vi.waitFor(() => expect(deps.callAPI).toHaveBeenCalledTimes(1));
      gate.resolve(OPENING);
      await p1;
      expect(deps.callAPI).toHaveBeenCalledTimes(1);
      const histories = (deps.dispatch as ReturnType<typeof vi.fn>).mock.calls
        .filter(([a]) => a.type === "SET_HISTORY");
      expect(histories).toHaveLength(1);
      const lastUser = histories[0][0].history.at(-1);
      expect(lastUser.content).toContain("go east");
    });

    it("cancelRequest releases the latch for the next submit immediately", async () => {
      const gate1 = deferred<string>();
      const callAPI = vi.fn()
        .mockImplementationOnce(() => gate1.promise)
        .mockImplementation(async () => OPENING);
      const deps = makeDeps({ callAPI, getState: () => MID_GAME });
      const loop = createGameLoop(deps);
      const p1 = loop.submit("first");
      await vi.waitFor(() => expect(callAPI).toHaveBeenCalledTimes(1));
      loop.cancelRequest();
      const p2 = loop.submit("second");
      await vi.waitFor(() => expect(callAPI).toHaveBeenCalledTimes(2));
      gate1.resolve(OPENING);
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(false);
      expect(r2).toBe(true);
    });

    it("undoLastTurn is blocked while a turn is in flight", async () => {
      const gate = deferred<string>();
      const deps = makeDeps({ callAPI: vi.fn(() => gate.promise), getState: () => MID_GAME });
      const loop = createGameLoop(deps);
      const p1 = loop.submit("go east");
      await vi.waitFor(() => expect(deps.callAPI).toHaveBeenCalledTimes(1));
      loop.undoLastTurn();
      const undos = (deps.dispatch as ReturnType<typeof vi.fn>).mock.calls
        .filter(([a]) => a.type === "UNDO");
      expect(undos).toHaveLength(0);
      gate.resolve(OPENING);
      await p1;
    });
  });

  describe("loadSave", () => {
    const SAVE: SaveRecord = {
      schemaVersion: 1,
      premiseId: PREMISES[0].id,
      entries: [
        { type: "narration", text: "hello", illustration: { status: "ready", url: "idb:k1" } },
      ] as Entry[],
      history: [{ role: "user", content: "Begin." }],
      ended: false,
      language: "en",
      metaMessages: [],
      metaMode: false,
    } as unknown as SaveRecord;

    it("rehydrates idb illustrations before the single LOAD_SAVE dispatch", async () => {
      const deps = makeDeps();
      const loop = createGameLoop(deps);
      await loop.loadSave(SAVE);
      const dispatched = (deps.dispatch as ReturnType<typeof vi.fn>).mock.calls.map(([a]) => a);
      const loads = dispatched.filter((a) => a.type === "LOAD_SAVE");
      expect(loads).toHaveLength(1);
      // getImage is mocked to miss, so the entry must arrive already-degraded.
      expect(loads[0].payload.entries[0].illustration.status).toBe("failed");
      const loadIndex = dispatched.findIndex((a) => a.type === "LOAD_SAVE");
      const trailingSetEntries = dispatched.slice(loadIndex + 1).filter((a) => a.type === "SET_ENTRIES");
      expect(trailingSetEntries).toHaveLength(0);
    });

    it("cancels an in-flight turn before loading", async () => {
      const gate = deferred<string>();
      const deps = makeDeps({ callAPI: vi.fn(() => gate.promise), getState: () => ({
        ...INITIAL_STATE,
        phase: "playing",
        premise: PREMISES[0],
        entries: [{ type: "narration", text: "o", fullyRevealed: true }],
        history: [
          { role: "user", content: "Begin." },
          { role: "assistant", content: OPENING },
        ],
      }) });
      const loop = createGameLoop(deps);
      const p1 = loop.submit("go east");
      await vi.waitFor(() => expect(deps.callAPI).toHaveBeenCalledTimes(1));
      const controller = deps.abortRef.current?.controller;
      expect(controller).toBeTruthy();
      await loop.loadSave(SAVE);
      expect(controller?.signal.aborted).toBe(true);
      expect(deps.abortRef.current).toBeNull();
      gate.resolve(OPENING);
      expect(await p1).toBe(false);
    });
  });
});
