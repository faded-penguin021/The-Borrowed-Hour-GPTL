// @vitest-environment jsdom
//
// Real orchestration tests for the game loop. Unlike the old cancellation
// "contract" test — which re-implemented toy fetch/rollback/turn functions
// inside the test and asserted on those — this file renders the ACTUAL
// <GameProvider> and drives the REAL `beginAdventure`, `submit`, and
// `cancelRequest` closures. The only things stubbed are the boundaries the loop
// talks to: the network client (callAPI/streamAPI) and the orthogonal
// subsystems (codex/saves/reveal/keepsake/progress/tts/ambience/settings).
// Everything under test — the split GM→Narrator flow, parse/repair, the
// reducer, abort + rollback, the malformed-retry path — runs for real.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, act, cleanup } from "@testing-library/react";
import type { CallAPI, StreamAPI } from "../llm/client";
import type { AppSettings, ChatMessage, EngineConfig, Premise, ToolDefinition } from "../types";

// ── Controllable doubles, hoisted so the vi.mock factories can close over them ──
const H = vi.hoisted(() => {
  const callAPI = vi.fn();
  const streamAPI = vi.fn();
  const ctrl: {
    opening: string;
    gm: string | string[];
    narration: string;
    gmCallCount: number;
    gmSignal: AbortSignal | null;
    gmGate: { promise: Promise<void>; release: () => void } | null;
    lastNarratorPrompt: string;
    settings: AppSettings | null;
  } = {
    opening: "",
    gm: "",
    narration: "",
    gmCallCount: 0,
    gmSignal: null,
    gmGate: null,
    lastNarratorPrompt: "",
    settings: null,
  };
  return { callAPI, streamAPI, ctrl };
});

// Network boundary: the loop's only real dependency we must not exercise.
vi.mock("../llm/client", () => ({
  createLLMClient: () => ({ callAPI: H.callAPI, streamAPI: H.streamAPI }),
}));

// Sibling contexts — inert stubs. settings is read live from the holder.
vi.mock("../context/SettingsContext", () => ({
  useSettingsContext: () => ({ settings: H.ctrl.settings }),
}));
vi.mock("../context/AmbienceContext", () => ({
  useAmbienceContext: () => ({
    ensureAmbienceEngine: vi.fn(async () => null),
    ambienceRef: { current: null },
    // Exercise the ambience-on path so the GM tool identity matches the
    // exported GM_LOGIC_TOOL constant the test compares against.
    ambienceLevel: "subtle",
  }),
}));
vi.mock("../context/TTSContext", () => ({
  useTTSContext: () => ({
    autoSpeak: vi.fn(),
    ttsRef: { current: null },
    stopTTS: vi.fn(),
    resetTTSCursor: vi.fn(),
    ttsEnabled: false,
    ttsMuted: false,
    ttsProviderId: "none",
  }),
}));

// Loop-owned domain hooks — orthogonal to the turn machinery under test.
vi.mock("../hooks/useCodex", () => ({
  useCodex: () => ({
    revokeAllPlates: vi.fn(),
    resetCodex: vi.fn(),
    restoreCodex: vi.fn(),
    runArtDirectorBootstrap: vi.fn(() => Promise.resolve()),
    runArtDirectorTurn: vi.fn(() => Promise.resolve()),
    styleBible: null,
    visualLedger: [],
    plateCount: 0,
  }),
}));
vi.mock("../hooks/useSaves", () => ({
  useSaves: () => ({
    setSaveBanner: vi.fn(),
    setShowSaves: vi.fn(),
    setExportFallbackText: vi.fn(),
    openSavesModal: vi.fn(),
    deleteSave: vi.fn(),
    saveCurrent: vi.fn(),
    exportChronicle: vi.fn(),
    hasAutosave: false,
    readAutosave: vi.fn(async () => null),
    writeAutosave: vi.fn(),
    clearAutosave: vi.fn(),
    saveBanner: null,
    showSaves: false,
    saveList: [],
    saveListLoading: false,
    savesTotalBytes: 0,
    exportFallbackText: null,
  }),
}));
vi.mock("../hooks/useReveal", () => ({
  useReveal: () => ({
    cancelReveal: vi.fn(),
    resetReveal: vi.fn(),
    triggerReveal: vi.fn(),
    revealText: "",
    revealLoading: false,
    revealError: null,
  }),
}));
vi.mock("../hooks/useKeepsake", () => ({
  useKeepsake: () => ({
    downloadKeepsake: vi.fn(),
    resetKeepsake: vi.fn(),
    generateKeepsake: vi.fn(),
    keepsakeBlob: null,
    keepsakeLoading: false,
    keepsakeError: null,
  }),
}));
vi.mock("../hooks/useProgress", () => ({
  useProgress: () => ({
    recordEnding: vi.fn(),
    getDiscoveredEndings: vi.fn(() => []),
  }),
}));

// Imports of the modules under test come AFTER the mocks (hoisting makes order
// irrelevant at runtime, but this keeps intent obvious).
import { DEFAULT_SETTINGS } from "../data/constants";
import { GM_LOGIC_TOOL } from "../llm/tools";
import { BorrowedError } from "../llm/errors";
import {
  GameProvider, useGameActions, useGameStory, useGameLive, useGameRun,
} from "../context/GameContext";

const PREMISE: Premise = {
  id: "test-realm",
  realm: "wild",
  realmLabel: "Test",
  title: "Test Hour",
  teaser: "A teaser.",
  seed: "A quiet room at the end of an ordinary day.",
  gmNote: "Keep it grounded.",
};

const OPENING = JSON.stringify({
  gm_scratchpad: "",
  narration: "You wake in a pale room, the light thin against the wall.",
  state: {
    scene: "A pale room", time: "Dawn",
    inventory: ["a brass key"], npcs: [], clues: [], summary: "The hour begins.",
    hidden_state: "",
  },
  ending: null,
});

const GM_LOGIC = JSON.stringify({
  gm_scratchpad: "The player approaches the door; Mara is the thief but that stays hidden.",
  narrator_brief: "Render the door swinging open; Mara hesitates and will not meet the player's eyes.",
  state: {
    ledger: {
      scene: "Threshold", time: "Dawn, a minute on",
      inventory: ["a brass key"],
      npcs: [{ name: "Mara", note: "wary; lingers by the sill" }],
      clues: ["the door was already unlocked"],
      summary: "The player crossed to the door and worked the brass key.",
    },
    hidden_state: "SECRET_TWIST: Mara unlocked it herself.",
  },
  ending: null,
});

const NARRATION = "The door gives way without a sound. Mara does not meet your eyes.";

// ── Render harness: capture the live hook values on every render ───────────────
type Captured = {
  actions: ReturnType<typeof useGameActions>;
  story: ReturnType<typeof useGameStory>;
  live: ReturnType<typeof useGameLive>;
  run: ReturnType<typeof useGameRun>;
};
let current: Captured;
function Capture() {
  current = {
    actions: useGameActions(),
    story: useGameStory(),
    live: useGameLive(),
    run: useGameRun(),
  };
  return null;
}
function mount() {
  render(
    <GameProvider>
      <Capture />
    </GameProvider>,
  );
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

// Default callAPI routing by tool name (the loop now always passes the tool
// explicitly, so we discriminate by tool.name rather than presence):
//   useTool=false                       → Narrator (non-streaming) call → NARRATION
//   useTool=true,  tool=gm_decide        → GM-logic stage              → ctrl.gm
//   useTool=true,  tool=narrate_and_…    → opening                     → ctrl.opening
function installDefaultClient() {
  const callAPI = H.callAPI as unknown as ReturnType<typeof vi.fn>;
  callAPI.mockImplementation((async (
    _sys: string, _msgs: ChatMessage[], useTool?: boolean, _engine?: EngineConfig,
    _maxTokens?: number, _temperature?: number, signal?: AbortSignal | null, tool?: ToolDefinition,
  ) => {
    if (!useTool) return H.ctrl.narration;
    if (tool?.name === "gm_decide") {
      H.ctrl.gmSignal = signal ?? null;
      if (H.ctrl.gmGate) await H.ctrl.gmGate.promise;
      const i = H.ctrl.gmCallCount++;
      return Array.isArray(H.ctrl.gm) ? H.ctrl.gm[Math.min(i, H.ctrl.gm.length - 1)] : H.ctrl.gm;
    }
    return H.ctrl.opening;
  }) as CallAPI);

  const streamAPI = H.streamAPI as unknown as ReturnType<typeof vi.fn>;
  streamAPI.mockImplementation((async (
    _sys: string, msgs: ChatMessage[], _engine: EngineConfig, _maxTokens: number,
    _temperature: number, _signal: AbortSignal, onDelta: (d: string) => void,
  ) => {
    H.ctrl.lastNarratorPrompt = typeof msgs?.[0]?.content === "string" ? msgs[0].content : "";
    onDelta(H.ctrl.narration);
    return H.ctrl.narration;
  }) as StreamAPI);
}

/** Drive the real beginAdventure to a playing state seeded with the opening. */
async function startGame() {
  await act(async () => { await current.actions.beginAdventure(PREMISE); });
}

beforeEach(() => {
  vi.clearAllMocks();
  H.ctrl.opening = OPENING;
  H.ctrl.gm = GM_LOGIC;
  H.ctrl.narration = NARRATION;
  H.ctrl.gmCallCount = 0;
  H.ctrl.gmSignal = null;
  H.ctrl.gmGate = null;
  H.ctrl.lastNarratorPrompt = "";
  H.ctrl.settings = { ...DEFAULT_SETTINGS, streamNarration: true };
  installDefaultClient();
  // The loop's per-turn diagnostics (apiHistory debug, malformed-response warn)
  // are expected here; keep them out of the test output.
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

describe("beginAdventure", () => {
  it("opens the chronicle: seeds entries/history/state and clears loading", async () => {
    mount();
    expect(current.story.phase).toBe("title");
    await startGame();

    expect(current.story.phase).toBe("playing");
    expect(current.run.loading).toBe(false);
    expect(current.run.error).toBeNull();

    // One opening narration entry, carrying the parsed prose.
    expect(current.live.entries).toHaveLength(1);
    expect(current.live.entries[0]).toMatchObject({ type: "narration" });
    expect((current.live.entries[0] as { text: string }).text).toContain("pale room");

    // History seeded with the "Begin." user turn + the raw assistant reply.
    expect(current.live.history[0]).toEqual({ role: "user", content: "Begin." });
    expect(current.live.history[1].role).toBe("assistant");
    expect(current.live.gameState.scene).toBe("A pale room");

    // The opening uses the single-stage system prompt + the opening engine.
    const openCall = H.callAPI.mock.calls.find((c) => c[2] === true && (c[7] as ToolDefinition | undefined)?.name === "narrate_and_update_state");
    expect(openCall).toBeTruthy();
    expect((openCall as unknown[])[0]).toContain("narrate_and_update_state");
    expect((openCall as unknown[])[0]).not.toContain("split in two");
    expect((openCall as unknown[])[3]).toBe(H.ctrl.settings!.engineOpening);
  });
});

describe("submit — split GM→Narrator flow", () => {
  it("calls the GM-logic stage with the split system + tool, then the Narrator", async () => {
    mount();
    await startGame();

    let result: boolean | undefined;
    await act(async () => { result = await current.actions.submit("go north"); });
    expect(result).toBe(true);

    // GM-logic stage: split system prompt, the gm tool, the GM engine.
    const gmCall = H.callAPI.mock.calls.find((c) => c[2] === true && c[7] === GM_LOGIC_TOOL);
    expect(gmCall).toBeTruthy();
    expect((gmCall as unknown[])[0]).toContain("split in two");
    expect((gmCall as unknown[])[3]).toBe(H.ctrl.settings!.engineGM);

    // Narrator stage ran on the narrator engine.
    expect(H.streamAPI).toHaveBeenCalledTimes(1);
    expect(H.streamAPI.mock.calls[0][2]).toBe(H.ctrl.settings!.engineNarrator);

    // Entries: opening narration, the player's action, the rendered narration.
    expect(current.live.entries).toHaveLength(3);
    expect(current.live.entries[1]).toMatchObject({ type: "action", text: "go north" });
    expect(current.live.entries[2]).toMatchObject({ type: "narration", text: NARRATION });

    // State advanced from the GM's ledger; hidden_state retained app-side.
    expect(current.live.gameState.scene).toBe("Threshold");
    expect(current.live.gameState.hidden_state).toContain("SECRET_TWIST");
    expect(current.run.error).toBeNull();
    expect(current.run.loading).toBe(false);
  });

  it("crosses the brief + public ledger to the Narrator but NOT hidden_state", async () => {
    mount();
    await startGame();
    await act(async () => { await current.actions.submit("open the door"); });

    const prompt = H.ctrl.lastNarratorPrompt;
    expect(prompt).toContain("Render the door swinging open"); // narrator_brief crosses
    expect(prompt).toContain("Threshold");                      // public scene crosses
    expect(prompt).not.toContain("SECRET_TWIST");               // hidden_state does not
    expect(prompt).not.toContain("Mara unlocked it herself");
  });

  it("writes the assistant turn + player action into history", async () => {
    mount();
    await startGame();
    await act(async () => { await current.actions.submit("go north"); });

    const userTurn = current.live.history.find(
      (m) => m.role === "user" && m.content.includes("[Player action]"),
    );
    expect(userTurn?.content).toContain("go north");

    const lastAssistant = [...current.live.history].reverse().find((m) => m.role === "assistant");
    expect(lastAssistant?.content).toContain(NARRATION);
  });

  it("renders via callAPI (not streamAPI) when streaming is disabled", async () => {
    H.ctrl.settings = { ...DEFAULT_SETTINGS, streamNarration: false };
    mount();
    await startGame();
    await act(async () => { await current.actions.submit("go north"); });

    expect(H.streamAPI).not.toHaveBeenCalled();
    const narrCall = H.callAPI.mock.calls.find((c) => c[2] === false);
    expect(narrCall).toBeTruthy();
    expect((narrCall as unknown[])[3]).toBe(H.ctrl.settings!.engineNarrator);
    expect(current.live.entries[2]).toMatchObject({ type: "narration", text: NARRATION });
  });
});

describe("submit — the story ledger round-trips into the next turn's prompt", () => {
  // The tier's whole claim is that a fact survives a turn boundary the mutable
  // state cannot carry. The only way to see that from outside is end-to-end:
  // turn 1 proposes a row, turn 2's GM prompt must open with it. Nothing here
  // reads the reducer directly, so a producer that dispatched into the void
  // (or a prompt that dropped the block) fails this.
  const GM_WITH_ROWS = JSON.stringify({
    ...JSON.parse(GM_LOGIC),
    story_ledger_append: [
      { kind: "established", text: "Mara unlocked the door herself." },
      { kind: "ruled_out", text: "The brass key will never open the east wing." }
    ]
  });

  it("appends the GM's rows and reads them back at the top of the next turn", async () => {
    H.ctrl.gm = [GM_WITH_ROWS, GM_LOGIC];
    mount();
    await startGame();
    await act(async () => { await current.actions.submit("open the door"); });
    await act(async () => { await current.actions.submit("go east"); });

    const gmCalls = H.callAPI.mock.calls.filter((c) => c[2] === true && c[7] === GM_LOGIC_TOOL);
    expect(gmCalls).toHaveLength(2);

    const firstMsgs = gmCalls[0][1] as ChatMessage[];
    expect(String(firstMsgs[firstMsgs.length - 1].content)).not.toContain("STORY LEDGER");

    const secondMsgs = gmCalls[1][1] as ChatMessage[];
    const latest = String(secondMsgs[secondMsgs.length - 1].content);
    expect(latest).toContain("STORY LEDGER");
    expect(latest).toContain("L-001");
    expect(latest).toContain("Mara unlocked the door herself.");
    expect(latest).toContain("RULED OUT");
    // Above the mutable state, and above the player's action.
    expect(latest.indexOf("STORY LEDGER")).toBeLessThan(latest.indexOf("CURRENT GAME STATE"));
    expect(latest.indexOf("STORY LEDGER")).toBeLessThan(latest.indexOf("[Player action]"));
  });

  it("emits no ledger block when the GM has proposed nothing", async () => {
    mount();
    await startGame();
    await act(async () => { await current.actions.submit("open the door"); });
    await act(async () => { await current.actions.submit("go east"); });

    const gmCalls = H.callAPI.mock.calls.filter((c) => c[2] === true && c[7] === GM_LOGIC_TOOL);
    const secondMsgs = gmCalls[1][1] as ChatMessage[];
    expect(String(secondMsgs[secondMsgs.length - 1].content)).not.toContain("STORY LEDGER");
  });
});

describe("submit — malformed GM response triggers one corrective retry", () => {
  it("retries the GM stage once, then succeeds", async () => {
    H.ctrl.gm = ["this is not valid json at all", GM_LOGIC];
    mount();
    await startGame();

    let result: boolean | undefined;
    await act(async () => { result = await current.actions.submit("go north"); });

    expect(result).toBe(true);
    expect(H.ctrl.gmCallCount).toBe(2); // first malformed, second parsed
    expect(current.live.entries[2]).toMatchObject({ type: "narration", text: NARRATION });
    expect(current.run.error).toBeNull();
  });
});

describe("submit — error path rolls back the optimistic turn", () => {
  it("surfaces the error and restores entries/history when the GM call fails", async () => {
    mount();
    await startGame();
    const entriesBefore = current.live.entries;
    const historyBefore = current.live.history;

    // Make the GM stage throw a non-cancellation error.
    (H.callAPI as unknown as ReturnType<typeof vi.fn>).mockImplementation((async (
      _sys: string, _msgs: ChatMessage[], useTool?: boolean, _engine?: EngineConfig,
      _maxTokens?: number, _temperature?: number, _signal?: AbortSignal | null, tool?: ToolDefinition,
    ) => {
      if (useTool && tool) throw new BorrowedError("The hour falters.", "boom");
      return H.ctrl.opening;
    }) as CallAPI);

    let result: boolean | undefined;
    await act(async () => { result = await current.actions.submit("go north"); });

    expect(result).toBe(false);
    expect(current.run.error).not.toBeNull();
    expect(current.run.loading).toBe(false);
    // Rolled back to exactly the pre-submit entries/history (no orphan action).
    expect(current.live.entries).toEqual(entriesBefore);
    expect(current.live.history).toEqual(historyBefore);
  });
});

describe("cancelRequest — aborts an in-flight submit and rolls back", () => {
  it("aborts the live signal, clears loading, and restores entries", async () => {
    // Gate the GM stage so the turn parks mid-flight.
    let release!: () => void;
    H.ctrl.gmGate = {
      promise: new Promise<void>((r) => { release = r; }),
      release: () => release(),
    };

    mount();
    await startGame();
    const entriesBefore = current.live.entries;
    const historyBefore = current.live.history;

    // Fire submit but do NOT await — it will block on the gated GM call.
    let submitPromise!: Promise<boolean>;
    await act(async () => {
      submitPromise = current.actions.submit("go north");
      await tick(); // let it apply the optimistic action + reach the GM await
    });

    // Optimistic state is in place and the turn is loading.
    expect(current.run.loading).toBe(true);
    expect(current.live.entries).toHaveLength(entriesBefore.length + 1);
    expect(current.live.entries[entriesBefore.length]).toMatchObject({ type: "action", text: "go north" });
    expect(H.ctrl.gmSignal?.aborted).toBe(false);

    // Cancel: the real cancelRequest aborts, resets loading, and runs rollback.
    await act(async () => { current.actions.cancelRequest(); });

    expect(H.ctrl.gmSignal?.aborted).toBe(true);
    expect(current.run.loading).toBe(false);
    expect(current.run.error).toBeNull();
    expect(current.live.entries).toEqual(entriesBefore);
    expect(current.live.history).toEqual(historyBefore);

    // Releasing the gate must not resurrect the cancelled turn.
    await act(async () => {
      H.ctrl.gmGate!.release();
      const settled = await submitPromise;
      expect(settled).toBe(false);
    });
    expect(current.live.entries).toEqual(entriesBefore);
    expect(current.run.error).toBeNull();
    expect(H.streamAPI).not.toHaveBeenCalled(); // narrator never ran
  });
});
