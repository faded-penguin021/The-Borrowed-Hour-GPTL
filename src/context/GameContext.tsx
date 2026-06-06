/* eslint-disable react-refresh/only-export-components -- provider co-located with its context hook(s); splitting churns every import site for a dev-only Fast Refresh gain */
import React, { createContext, useContext, useReducer, useState, useRef, useEffect, useMemo } from "react";
import type { ChatMessage, Entry, GameState, MetaMessage, Premise, SaveRecord } from "../types";
import type { SetStateAction, Dispatch } from "react";
import { createLLMClient } from "../llm/client";
import { defaultAmbienceForRealm, deriveAmbienceFromSeed } from "../ambience/tables";
import { useCodex } from "../hooks/useCodex";
import { useSaves } from "../hooks/useSaves";
import { useAutosave } from "../hooks/useAutosave";
import { useReveal } from "../hooks/useReveal";
import { useKeepsake } from "../hooks/useKeepsake";
import { useProgress } from "../hooks/useProgress";
import { useLatest } from "../hooks/useLatest";
import { useSettingsContext } from "./SettingsContext";
import { useAmbienceContext } from "./AmbienceContext";
import { useTTSContext } from "./TTSContext";
import {
  storyReducer, INITIAL_STATE, createStreamingStore,
  type Recovery, type StreamingStore,
} from "./storyReducer";
import { createGameLoop, type AbortRef } from "./gameLoop";

type SavesHook = ReturnType<typeof useSaves>;
type RevealHook = ReturnType<typeof useReveal>;
type KeepsakeHook = ReturnType<typeof useKeepsake>;

/**
 * The stable dispatch surface. Every member's identity is fixed for the life of
 * the provider, so a dispatch-only consumer never re-renders on state churn.
 */
interface GameActions {
  setLanguage: React.Dispatch<React.SetStateAction<string>>;
  beginAdventure: (chosen: Premise) => Promise<void>;
  submit: (text: string) => Promise<boolean>;
  continueNarration: () => Promise<void>;
  undoLastTurn: () => void;
  restart: () => void;
  loadSave: (save: SaveRecord) => Promise<void>;
  resumeAutosave: () => Promise<void>;
  enterMetaMode: () => void;
  exitMetaMode: () => void;
  skipReveal: () => void;
  cancelRequest: () => void;
  saveCurrent: () => Promise<void>;
  exportChronicle: (includeMeta?: boolean) => Promise<void>;
  startReveal: () => Promise<void> | undefined;
  startKeepsake: () => Promise<void> | undefined;
  markEntryRevealed: (index: number) => void;
  markMetaRevealed: (index: number) => void;
  cancelReveal: RevealHook["cancelReveal"];
  downloadKeepsake: KeepsakeHook["downloadKeepsake"];
  openSavesModal: SavesHook["openSavesModal"];
  deleteSave: SavesHook["deleteSave"];
  getDiscoveredEndings: (premiseId: string | null | undefined) => string[];
  setSaveBanner: SavesHook["setSaveBanner"];
  setShowSaves: SavesHook["setShowSaves"];
  setExportFallbackText: SavesHook["setExportFallbackText"];
}

/** Low-churn story state. Stays referentially stable across streaming deltas. */
interface GameStoryValue {
  phase: string;
  premise: Premise | null;
  language: string;
  ended: boolean;
  metaMode: boolean;
  canUndo: boolean;
  entriesCount: number;
  hasMeta: boolean;
  hasAutosave: boolean;
  keepsakeFilename: string;
}

/** High-churn live state plus the saves/reveal/keepsake reactive surfaces. */
interface GameLiveValue {
  entries: Entry[];
  gameState: GameState;
  history: ChatMessage[];
  metaMessages: MetaMessage[];
  skipNonce: number;
  recovery: Recovery | null;
  streamingStore: StreamingStore;
  saveBanner: SavesHook["saveBanner"];
  showSaves: SavesHook["showSaves"];
  saveList: SavesHook["saveList"];
  saveListLoading: SavesHook["saveListLoading"];
  savesTotalBytes: SavesHook["savesTotalBytes"];
  exportFallbackText: SavesHook["exportFallbackText"];
  revealText: RevealHook["revealText"];
  revealLoading: RevealHook["revealLoading"];
  revealError: RevealHook["revealError"];
  keepsakeBlob: KeepsakeHook["keepsakeBlob"];
  keepsakeLoading: KeepsakeHook["keepsakeLoading"];
  keepsakeError: KeepsakeHook["keepsakeError"];
}

/**
 * Transient runtime state, kept apart so its churn doesn't re-render story-only
 * consumers.
 */
interface GameRunValue {
  loading: boolean;
  loadingPhrase: string;
  error: { message: string; detail: string | null; raw: unknown } | null;
  sessionTokens: { input: number; output: number };
}

// Four contexts, split by churn rate so a consumer only re-renders on the slice
// it actually reads.
const GameActionsContext = createContext<GameActions | null>(null);
const GameStoryContext = createContext<GameStoryValue | null>(null);
const GameLiveContext = createContext<GameLiveValue | null>(null);
const GameRunContext = createContext<GameRunValue | null>(null);

export function useGameActions() {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error("useGameActions must be used within a <GameProvider>");
  return ctx;
}

export function useGameStory() {
  const ctx = useContext(GameStoryContext);
  if (!ctx) throw new Error("useGameStory must be used within a <GameProvider>");
  return ctx;
}

export function useGameLive() {
  const ctx = useContext(GameLiveContext);
  if (!ctx) throw new Error("useGameLive must be used within a <GameProvider>");
  return ctx;
}

export function useGameRun() {
  const ctx = useContext(GameRunContext);
  if (!ctx) throw new Error("useGameRun must be used within a <GameProvider>");
  return ctx;
}

export function useGame(): GameStoryValue & GameLiveValue & GameActions {
  const actions = useGameActions();
  const story = useGameStory();
  const live = useGameLive();
  return useMemo(() => ({ ...story, ...live, ...actions }), [story, live, actions]);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsContext();
  const ambience = useAmbienceContext();
  const tts = useTTSContext();

  // ── Core story state (reducer) ────────────────────────────────────
  const [s, dispatch] = useReducer(storyReducer, INITIAL_STATE);
  const { phase, premise, entries, history, ended, gameState, language,
          metaMode, metaMessages, skipNonce, recovery } = s;
  const error = s.error;

  const [loading, setLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 });
  const sessionTokensRef = useRef({ input: 0, output: 0 });

  const streamingStore = useRef(createStreamingStore()).current;
  const abortRef = useRef<AbortRef | null>(null);
  const settingsRef = useLatest(settings);
  const stateRef = useLatest(s);
  const loadingRef = useLatest(loading);

  // ── API layer ────────────────────────────────────────────────────
  const clientRef = useRef<ReturnType<typeof createLLMClient> | null>(null);
  if (!clientRef.current) {
    clientRef.current = createLLMClient({
      getDefaultEngine: () => settingsRef.current.engineNarrator,
      getProxyUrl: () => settingsRef.current.proxyUrl,
      onUsage: (inp: number, out: number) => {
        if (!inp && !out) return;
        sessionTokensRef.current = {
          input: sessionTokensRef.current.input + inp,
          output: sessionTokensRef.current.output + out
        };
        setSessionTokens({ ...sessionTokensRef.current });
      }
    });
  }
  const { callAPI, streamAPI } = clientRef.current;

  // ── Domain hooks owned by the loop ───────────────────────────────
  const dispatchSetEntries: Dispatch<SetStateAction<Entry[]>> = (action) => {
    if (typeof action === "function") {
      dispatch({ type: "UPDATE_ENTRIES", updater: action });
    } else {
      dispatch({ type: "SET_ENTRIES", entries: action });
    }
  };
  const codex = useCodex({ callAPI, settings, premise, language, setEntries: dispatchSetEntries });
  const saves = useSaves();
  const reveal = useReveal({
    streamAPI,
    getEngine: () => settingsRef.current.engineNarrator,
  });
  const keepsake = useKeepsake({ setExportFallbackText: (text) => saves.setExportFallbackText(text) });
  const progress = useProgress();

  const { ensureAmbienceEngine, ambienceRef } = ambience;

  const codexSnapshot = useMemo(
    () => ({ styleBible: codex.styleBible, visualLedger: codex.visualLedger, plateCount: codex.plateCount }),
    [codex.styleBible, codex.visualLedger, codex.plateCount]
  );

  // ── Autosave ────────────────────────────────────────────────────
  useAutosave(
    { phase, loading, premise, entries, ended, gameState, history, metaMessages, metaMode, language, codex: codexSnapshot },
    saves.writeAutosave
  );

  // ── Game loop ───────────────────────────────────────────────────
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  if (!loopRef.current) {
    loopRef.current = createGameLoop({
      getState: () => stateRef.current,
      getSettings: () => settingsRef.current,
      getLoading: () => loadingRef.current,
      dispatch,
      setLoading,
      setLoadingPhrase,
      resetSessionTokens: () => {
        sessionTokensRef.current = { input: 0, output: 0 };
        setSessionTokens({ input: 0, output: 0 });
      },
      abortRef,
      streamingStore,
      callAPI,
      streamAPI,
      codex,
      saves: {
        setSaveBanner: saves.setSaveBanner,
        clearAutosave: saves.clearAutosave,
        setShowSaves: saves.setShowSaves,
        readAutosave: saves.readAutosave,
      },
      progress: { recordEnding: progress.recordEnding },
      tts: { ttsRef: tts.ttsRef, stopTTS: tts.stopTTS, resetTTSCursor: tts.resetTTSCursor },
      ambience: { ensureAmbienceEngine, ambienceRef },
      reveal: { resetReveal: reveal.resetReveal },
      keepsake: { resetKeepsake: keepsake.resetKeepsake },
    });
  }
  const loop = loopRef.current;

  // ── Auto-speak newly revealed narration ──────────────────────────
  useEffect(() => {
    tts.autoSpeak(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, tts.ttsEnabled, tts.ttsMuted, tts.ttsProviderId]);

  // ── Late-enable ambience during play ─────────────────────────────
  useEffect(() => {
    const eng = ambienceRef.current;
    if (eng) return;
    if (ambience.ambienceLevel !== "off" && phase === "playing" && premise) {
      (async () => {
        const built = await ensureAmbienceEngine();
        if (built) {
          const bed = (premise.realm === "wild" && premise.seed)
            ? deriveAmbienceFromSeed(premise.seed)
            : defaultAmbienceForRealm(premise.realm);
          built.applyAmbience(bed);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambience.ambienceLevel]);

  // ── Auto-abort stale background requests ─────────────────────────
  useEffect(() => {
    const STALE_AFTER_MS = 90000;
    const onVisibility = () => {
      if (document.hidden) return;
      const ref = abortRef.current;
      if (!ref) return;
      const age = Date.now() - (ref.startedAt || 0);
      if (age > STALE_AFTER_MS) {
        try { ref.controller.abort(); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── Dismiss the save banner after a beat ─────────────────────────
  useEffect(() => {
    if (!saves.saveBanner) return;
    const t = setTimeout(() => saves.setSaveBanner(null), 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saves.saveBanner]);

  // ── Local actions (not part of the game loop) ───────────────────
  const skipReveal = () => dispatch({ type: "SKIP_REVEAL" });
  const enterMetaMode = () => dispatch({ type: "ENTER_META" });
  const exitMetaMode = () => dispatch({ type: "EXIT_META" });

  const canUndo = !loading && !metaMode && history.length >= 4 && entries.length >= 3;

  const saveCurrent = () => saves.saveCurrent({
    premise, entries, ended, gameState, history, metaMessages, metaMode, language,
    codex: codexSnapshot
  });

  const exportChronicle = (includeMeta = false) =>
    saves.exportChronicle({ premise, entries, ended, metaMessages }, includeMeta);

  const startReveal = () => {
    if (!premise) return;
    return reveal.triggerReveal(premise, entries, gameState, language);
  };

  const startKeepsake = () => {
    if (!premise) return;
    return keepsake.generateKeepsake({
      premise, entries, revealText: reveal.revealText, metaMessages, ended,
      hiddenState: ended ? gameState?.hidden_state : undefined
    });
  };

  const keepsakeFilename = premise
    ? `the-borrowed-hour-${premise.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}.html`
    : "the-borrowed-hour.html";

  const markEntryRevealed = (index: number) => {
    dispatch({ type: "UPDATE_ENTRIES", updater: (prev) => prev.map((e, i) => i === index ? { ...e, fullyRevealed: true } : e) });
  };

  const markMetaRevealed = (index: number) => {
    dispatch({ type: "SET_META_MESSAGES", metaMessages: s.metaMessages.map((m, i) => i === index ? { ...m, fullyRevealed: true } : m) });
  };

  const setLanguage = (lang: React.SetStateAction<string>) => {
    const resolved = typeof lang === "function" ? lang(s.language) : lang;
    dispatch({ type: "SET_LANGUAGE", language: resolved });
  };

  const entriesCount = entries.length;
  const hasMeta = metaMessages.length > 0;

  // ── Stable action surface ────────────────────────────────────────
  const liveActions: GameActions = {
    setLanguage,
    beginAdventure: loop.beginAdventure,
    submit: loop.submit,
    continueNarration: loop.continueNarration,
    undoLastTurn: loop.undoLastTurn,
    restart: loop.restart,
    loadSave: loop.loadSave,
    resumeAutosave: loop.resumeAutosave,
    enterMetaMode, exitMetaMode,
    skipReveal, cancelRequest: loop.cancelRequest,
    saveCurrent, exportChronicle,
    startReveal, startKeepsake,
    markEntryRevealed, markMetaRevealed,
    cancelReveal: reveal.cancelReveal,
    downloadKeepsake: keepsake.downloadKeepsake,
    openSavesModal: saves.openSavesModal,
    deleteSave: saves.deleteSave,
    getDiscoveredEndings: progress.getDiscoveredEndings,
    setSaveBanner: saves.setSaveBanner,
    setShowSaves: saves.setShowSaves,
    setExportFallbackText: saves.setExportFallbackText,
  };
  const liveActionsRef = useLatest(liveActions);
  const actions = useMemo(() => {
    const out: Record<string, (...args: unknown[]) => unknown> = {};
    for (const name of Object.keys(liveActionsRef.current)) {
      out[name] = (...args: unknown[]) =>
        (liveActionsRef.current as unknown as Record<string, (...args: unknown[]) => unknown>)[name](...args);
    }
    return out as unknown as GameActions;
  }, [liveActionsRef]);

  // ── Context values ──────────────────────────────────────────────
  const story: GameStoryValue = useMemo(() => ({
    phase, premise, language, ended, metaMode,
    canUndo, entriesCount, hasMeta, hasAutosave: saves.hasAutosave, keepsakeFilename,
  }), [phase, premise, language, ended, metaMode, canUndo, entriesCount, hasMeta, saves.hasAutosave, keepsakeFilename]);

  const live: GameLiveValue = useMemo(() => ({
    entries, gameState, history, metaMessages, skipNonce, recovery, streamingStore,
    saveBanner: saves.saveBanner,
    showSaves: saves.showSaves,
    saveList: saves.saveList,
    saveListLoading: saves.saveListLoading,
    savesTotalBytes: saves.savesTotalBytes,
    exportFallbackText: saves.exportFallbackText,
    revealText: reveal.revealText,
    revealLoading: reveal.revealLoading,
    revealError: reveal.revealError,
    keepsakeBlob: keepsake.keepsakeBlob,
    keepsakeLoading: keepsake.keepsakeLoading,
    keepsakeError: keepsake.keepsakeError,
  }), [
    entries, gameState, history, metaMessages, skipNonce, recovery, streamingStore,
    saves.saveBanner, saves.showSaves, saves.saveList, saves.saveListLoading,
    saves.savesTotalBytes, saves.exportFallbackText,
    reveal.revealText, reveal.revealLoading, reveal.revealError,
    keepsake.keepsakeBlob, keepsake.keepsakeLoading, keepsake.keepsakeError,
  ]);

  const runValue: GameRunValue = useMemo(
    () => ({ loading, loadingPhrase, error, sessionTokens }),
    [loading, loadingPhrase, error, sessionTokens]
  );

  return (
    <GameActionsContext.Provider value={actions}>
      <GameStoryContext.Provider value={story}>
        <GameLiveContext.Provider value={live}>
          <GameRunContext.Provider value={runValue}>{children}</GameRunContext.Provider>
        </GameLiveContext.Provider>
      </GameStoryContext.Provider>
    </GameActionsContext.Provider>
  );
}
