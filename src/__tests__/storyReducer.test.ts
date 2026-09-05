import { describe, it, expect } from "vitest";
import {
  storyReducer, INITIAL_STATE,
  type StoryState, type LoadSavePayload,
} from "../context/storyReducer";
import { turnOf } from "../context/storyLedger";
import { EMPTY_LEDGER, EMPTY_STATE } from "../data/constants";
import type { ChatMessage, Entry, GameState, Premise } from "../types";

const narration = (text: string): Entry => ({
  type: "narration", text, fullyRevealed: true,
});

const action = (text: string): Entry => ({
  type: "action", text, fullyRevealed: true,
});

const msg = (role: "user" | "assistant", content: string): ChatMessage => ({
  role, content,
});

const PREMISE: Premise = {
  id: "test", realm: "noir", realmLabel: "Noir",
  title: "Test Premise", teaser: "A test.", seed: "seed", gmNote: "note",
};

const STATE_WITH_HISTORY: GameState = {
  scene: "A dark room", time: "midnight",
  inventory: ["key"], npcs: [{ name: "Ada", note: "suspect" }],
  clues: ["footprint"], summary: "Entered the room.",
  hidden_state: "The key opens the safe.",
};

function playing(overrides: Partial<StoryState> = {}): StoryState {
  return {
    ...INITIAL_STATE,
    phase: "playing",
    premise: PREMISE,
    ...overrides,
  };
}

// ── UNDO ──────────────────────────────────────────────────────────────────────

describe("UNDO", () => {
  it("reverts entries, history, and gameState", () => {
    const before = playing({
      entries: [narration("first"), action("go north"), narration("second")],
      history: [msg("assistant", "first"), msg("user", "go north"), msg("assistant", "second")],
      gameState: STATE_WITH_HISTORY,
      ended: true,
    });
    const undoneEntries = [narration("first")];
    const undoneHistory = [msg("assistant", "first")];
    const result = storyReducer(before, {
      type: "UNDO",
      entries: undoneEntries,
      history: undoneHistory,
      gameState: EMPTY_STATE,
      turn: turnOf(undoneHistory),
    });
    expect(result.entries).toEqual(undoneEntries);
    expect(result.history).toEqual(undoneHistory);
    expect(result.gameState).toEqual(EMPTY_STATE);
  });

  it("resets ended to false", () => {
    const before = playing({ ended: true });
    const result = storyReducer(before, {
      type: "UNDO", entries: [], history: [], gameState: EMPTY_STATE, turn: 0,
    });
    expect(result.ended).toBe(false);
  });

  it("clears error and recovery", () => {
    const before = playing({
      error: { message: "boom", detail: null, raw: null },
      recovery: { narratorSys: "", narratorPrompt: "", gmParsed: {}, baseEntries: [], baseHistory: [], partial: "" },
    });
    const result = storyReducer(before, {
      type: "UNDO", entries: [], history: [], gameState: EMPTY_STATE, turn: 0,
    });
    expect(result.error).toBeNull();
    expect(result.recovery).toBeNull();
  });

  it("clamps frozenPrefixLength to new history length", () => {
    const before = playing({
      frozenPrefixLength: 5,
      history: [msg("assistant", "a"), msg("user", "b"), msg("assistant", "c"), msg("user", "d"), msg("assistant", "e")],
    });
    const undoneHistory = [msg("assistant", "a"), msg("user", "b")];
    const result = storyReducer(before, {
      type: "UNDO", entries: [], history: undoneHistory, gameState: EMPTY_STATE, turn: turnOf(undoneHistory),
    });
    expect(result.frozenPrefixLength).toBe(2);
  });

  it("preserves frozenPrefixLength when already within bounds", () => {
    const before = playing({ frozenPrefixLength: 1 });
    const undoneHistory = [msg("assistant", "a"), msg("user", "b"), msg("assistant", "c")];
    const result = storyReducer(before, {
      type: "UNDO", entries: [], history: undoneHistory, gameState: EMPTY_STATE, turn: turnOf(undoneHistory),
    });
    expect(result.frozenPrefixLength).toBe(1);
  });

  it("clamps prunedPrefixLength to the droppable span of the new history", () => {
    const before = playing({
      prunedPrefixLength: 6,
      history: [msg("assistant", "a"), msg("user", "b"), msg("assistant", "c"), msg("user", "d"), msg("assistant", "e")],
    });
    // After undo, history has 3 messages; with a 2-message head only 1 is droppable.
    const undoneHistory = [msg("assistant", "a"), msg("user", "b"), msg("assistant", "c")];
    const result = storyReducer(before, {
      type: "UNDO", entries: [], history: undoneHistory, gameState: EMPTY_STATE, turn: turnOf(undoneHistory),
    });
    expect(result.prunedPrefixLength).toBe(1);
  });
});

// ── APPEND_TURN ───────────────────────────────────────────────────────────────

describe("APPEND_TURN", () => {
  it("replaces entries and history", () => {
    const before = playing();
    const newEntries = [narration("hello"), action("look"), narration("you see a door")];
    const newHistory = [msg("assistant", "hello"), msg("user", "look"), msg("assistant", "you see a door")];
    const result = storyReducer(before, {
      type: "APPEND_TURN", entries: newEntries, history: newHistory,
    });
    expect(result.entries).toEqual(newEntries);
    expect(result.history).toEqual(newHistory);
  });

  it("updates gameState when provided", () => {
    const before = playing();
    const result = storyReducer(before, {
      type: "APPEND_TURN", entries: [], history: [], gameState: STATE_WITH_HISTORY,
    });
    expect(result.gameState).toEqual(STATE_WITH_HISTORY);
  });

  it("preserves gameState when not provided", () => {
    const before = playing({ gameState: STATE_WITH_HISTORY });
    const result = storyReducer(before, {
      type: "APPEND_TURN", entries: [], history: [],
    });
    expect(result.gameState).toEqual(STATE_WITH_HISTORY);
  });

  it("sets ended to true when flagged", () => {
    const before = playing();
    const result = storyReducer(before, {
      type: "APPEND_TURN", entries: [], history: [], ended: true,
    });
    expect(result.ended).toBe(true);
  });

  it("does not set ended when not flagged", () => {
    const before = playing({ ended: false });
    const result = storyReducer(before, {
      type: "APPEND_TURN", entries: [], history: [],
    });
    expect(result.ended).toBe(false);
  });
});

// ── STREAM_FINALIZE ───────────────────────────────────────────────────────────

describe("STREAM_FINALIZE", () => {
  it("updates the narration entry at narrationIndex", () => {
    const before = playing({
      entries: [narration("placeholder")],
      history: [msg("assistant", "placeholder")],
    });
    const result = storyReducer(before, {
      type: "STREAM_FINALIZE",
      narrationIndex: 0,
      text: "The door creaks open.",
      fullyRevealed: false,
      history: [msg("assistant", "The door creaks open.")],
    });
    expect(result.entries[0]).toMatchObject({
      type: "narration",
      text: "The door creaks open.",
      fullyRevealed: false,
    });
  });

  it("preserves illustration on existing entry", () => {
    const ill = { status: "ready" as const, url: "blob:abc", prompt: "test" };
    const before = playing({
      entries: [{ type: "narration" as const, text: "old", fullyRevealed: true, illustration: ill }],
    });
    const result = storyReducer(before, {
      type: "STREAM_FINALIZE",
      narrationIndex: 0,
      text: "new text",
      fullyRevealed: true,
      history: [],
    });
    expect(result.entries[0].illustration).toEqual(ill);
  });

  it("updates gameState and ended when provided", () => {
    const before = playing();
    const result = storyReducer(before, {
      type: "STREAM_FINALIZE",
      narrationIndex: 0,
      text: "end",
      fullyRevealed: true,
      history: [],
      gameState: STATE_WITH_HISTORY,
      ended: true,
    });
    expect(result.gameState).toEqual(STATE_WITH_HISTORY);
    expect(result.ended).toBe(true);
  });
});

// ── LOAD_SAVE ─────────────────────────────────────────────────────────────────

describe("LOAD_SAVE", () => {
  const payload: LoadSavePayload = {
    premise: PREMISE,
    entries: [narration("saved text")],
    history: [msg("assistant", "saved text")],
    ended: true,
    gameState: STATE_WITH_HISTORY,
    ledger: EMPTY_LEDGER,
    language: "fr",
    metaMessages: [{ role: "user", text: "hello", fullyRevealed: true }],
    metaMode: true,
  };

  it("replaces state from save payload", () => {
    const result = storyReducer(INITIAL_STATE, { type: "LOAD_SAVE", payload });
    expect(result.phase).toBe("playing");
    expect(result.premise).toEqual(PREMISE);
    expect(result.entries).toEqual(payload.entries);
    expect(result.history).toEqual(payload.history);
    expect(result.ended).toBe(true);
    expect(result.gameState).toEqual(STATE_WITH_HISTORY);
    expect(result.language).toBe("fr");
    expect(result.metaMessages).toEqual(payload.metaMessages);
    expect(result.metaMode).toBe(true);
  });

  it("clears error, recovery, and resets frozenPrefixLength", () => {
    const dirty = playing({
      error: { message: "err", detail: null, raw: null },
      recovery: { narratorSys: "", narratorPrompt: "", gmParsed: {}, baseEntries: [], baseHistory: [], partial: "" },
      frozenPrefixLength: 10,
    });
    const result = storyReducer(dirty, { type: "LOAD_SAVE", payload });
    expect(result.error).toBeNull();
    expect(result.recovery).toBeNull();
    expect(result.frozenPrefixLength).toBe(0);
  });

  it("resets prunedPrefixLength", () => {
    const dirty = playing({ prunedPrefixLength: 20 });
    const result = storyReducer(dirty, { type: "LOAD_SAVE", payload });
    expect(result.prunedPrefixLength).toBe(0);
  });
});

// ── RESET ─────────────────────────────────────────────────────────────────────

describe("RESET", () => {
  it("returns to initial state", () => {
    const dirty = playing({
      entries: [narration("text")],
      ended: true,
      gameState: STATE_WITH_HISTORY,
      frozenPrefixLength: 5,
    });
    const result = storyReducer(dirty, { type: "RESET" });
    expect(result).toEqual(INITIAL_STATE);
  });
});

// ── SET_GAME_STATE ────────────────────────────────────────────────────────────

describe("SET_GAME_STATE", () => {
  it("updates gameState including hidden_state", () => {
    const before = playing();
    const result = storyReducer(before, {
      type: "SET_GAME_STATE", gameState: STATE_WITH_HISTORY,
    });
    expect(result.gameState).toEqual(STATE_WITH_HISTORY);
    expect(result.gameState.hidden_state).toBe("The key opens the safe.");
  });
});

// ── SET_FROZEN_PREFIX ─────────────────────────────────────────────────────────

describe("SET_FROZEN_PREFIX", () => {
  it("updates frozenPrefixLength", () => {
    const before = playing({ frozenPrefixLength: 0 });
    const result = storyReducer(before, { type: "SET_FROZEN_PREFIX", length: 4 });
    expect(result.frozenPrefixLength).toBe(4);
  });
});

// ── SET_PRUNED_PREFIX ─────────────────────────────────────────────────────────

describe("SET_PRUNED_PREFIX", () => {
  it("updates prunedPrefixLength", () => {
    const before = playing({ prunedPrefixLength: 0 });
    const result = storyReducer(before, { type: "SET_PRUNED_PREFIX", length: 20 });
    expect(result.prunedPrefixLength).toBe(20);
  });
});
