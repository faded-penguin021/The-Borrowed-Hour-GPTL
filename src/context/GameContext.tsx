/* eslint-disable react-refresh/only-export-components -- provider co-located with its context hook(s); splitting churns every import site for a dev-only Fast Refresh gain */
import React, { createContext, useContext, useReducer, useState, useRef, useEffect, useMemo } from "react";
import type { ChatMessage, Entry, GameState, MetaMessage, NarrationEntry, Premise, SaveRecord, ThrownError } from "../types";
import type { SetStateAction, Dispatch } from "react";
import { EMPTY_STATE } from "../data/constants";
import { PREMISES, NARRATION_LOADING_PHRASES, META_LOADING_PHRASES, OPENING_LOADING_PHRASES, pickPhrase } from "../data/premises";
import { GM_LOGIC_TOOL, buildSystem, buildNarratorSystem, buildMetaSystem } from "../llm/tools";
import { parseGMResponse, parseGMLogicResponse, isStateEmpty } from "../llm/parse";
import { formatStateForPrompt, stripHistoricalUser, stripHistoricalAssistant, serializeStatePublic } from "../llm/prompt";
import { formatError, BorrowedError } from "../llm/errors";
import { createLLMClient } from "../llm/client";
import { defaultAmbienceForRealm, deriveAmbienceFromSeed } from "../ambience/tables";
import { getImage } from "../storage/imageStore";
import { useCodex } from "../hooks/useCodex";
import { useSaves } from "../hooks/useSaves";
import { useReveal } from "../hooks/useReveal";
import { useKeepsake } from "../hooks/useKeepsake";
import { useProgress } from "../hooks/useProgress";
import { useLatest } from "../hooks/useLatest";
import { useSettingsContext } from "./SettingsContext";
import { useAmbienceContext } from "./AmbienceContext";
import { useTTSContext } from "./TTSContext";
import {
  storyReducer, INITIAL_STATE, createStreamingStore,
  type Recovery, type RecoveryGMParsed, type StreamingStore,
} from "./storyReducer";

/** In-flight request handle: the abort controller plus its rollback closure. */
type AbortRef = { controller: AbortController; rollback?: () => void; startedAt: number };

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
// it actually reads:
//   • Actions  — stable dispatch surface; its identity never changes, so
//                dispatch-only components never re-render on state churn.
//   • Story    — low-churn story state (phase, premise, language, ended,
//                metaMode, plus per-turn-stable derivations). Unchanged during
//                streaming, so consumers stay put while narration streams.
//   • Live     — high-churn state (entries, gameState, history, metaMessages)
//                and the saves/reveal/keepsake reactive surfaces.
//   • Run      — transient runtime state (loading, phrase, error, tokens).
const GameActionsContext = createContext<GameActions | null>(null);
const GameStoryContext = createContext<GameStoryValue | null>(null);
const GameLiveContext = createContext<GameLiveValue | null>(null);
const GameRunContext = createContext<GameRunValue | null>(null);

/**
 * Stable game actions (submit, beginAdventure, save/reveal/keepsake, setters…).
 * Their identities never change, so a component that only dispatches won't
 * re-render when story/live state churns.
 */
export function useGameActions() {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error("useGameActions must be used within a <GameProvider>");
  return ctx;
}

/**
 * Low-churn story state: phase, premise, language, ended, metaMode, canUndo,
 * entriesCount, hasMeta, keepsakeFilename. Stays referentially stable across
 * streaming deltas.
 */
export function useGameStory() {
  const ctx = useContext(GameStoryContext);
  if (!ctx) throw new Error("useGameStory must be used within a <GameProvider>");
  return ctx;
}

/**
 * High-churn state: entries, gameState, history, metaMessages, plus the
 * saves/reveal/keepsake reactive surfaces. Re-renders on narration churn — use
 * only where that's expected (e.g. the narration log).
 */
export function useGameLive() {
  const ctx = useContext(GameLiveContext);
  if (!ctx) throw new Error("useGameLive must be used within a <GameProvider>");
  return ctx;
}

/**
 * Access the high-frequency / transient runtime state (loading, loading phrase,
 * error, session token tally). Kept apart so transient runtime churn doesn't
 * re-render consumers that only care about story state.
 */
export function useGameRun() {
  const ctx = useContext(GameRunContext);
  if (!ctx) throw new Error("useGameRun must be used within a <GameProvider>");
  return ctx;
}

/**
 * Backwards-compatibility shim: merges the stable actions, low-churn story
 * state, and high-churn live state into the single object the original
 * `useGame()` returned. Existing consumers keep working unchanged; new or
 * hot-path code should reach for the narrow hooks above so it only re-renders
 * on the slice it reads. Note `input` is deliberately not here — it lives
 * locally in the composer so keystrokes never re-render any consumer.
 */
export function useGame(): GameStoryValue & GameLiveValue & GameActions {
  const actions = useGameActions();
  const story = useGameStory();
  const live = useGameLive();
  return useMemo(() => ({ ...story, ...live, ...actions }), [story, live, actions]);
}

/**
 * Holds the core game-loop state and orchestrates the multi-agent calls.
 * Settings, ambience, and TTS come from their own contexts; codex and saves are
 * owned here because only the loop drives them.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsContext();
  const ambience = useAmbienceContext();
  const tts = useTTSContext();

  // ── Core story state (reducer) ────────────────────────────────────
  const [s, dispatch] = useReducer(storyReducer, INITIAL_STATE);
  const { phase, premise, entries, history, ended, gameState, language,
          metaMode, metaMessages, skipNonce, recovery, frozenPrefixLength } = s;
  const error = s.error;

  // Transient runtime state stays outside the reducer — loading, phrase, and
  // tokens are high-frequency / ephemeral and have no cross-field invariants.
  const [loading, setLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 });
  const sessionTokensRef = useRef({ input: 0, output: 0 });

  // Streaming store: text accumulator for in-flight narration deltas.
  // Components subscribe via useSyncExternalStore; onDelta writes here instead
  // of dispatching per-token state updates.
  const streamingStore = useRef(createStreamingStore()).current;

  const abortRef = useRef<AbortRef | null>(null);
  // Mirror settings so the long-lived API client closure always reads the
  // freshest engine config without re-creating the client.
  const settingsRef = useLatest(settings);

  // ── API layer (shared module; codex reuses callAPI) ───────────────
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
  // useCodex expects a React-style setEntries (value or updater). Wrap dispatch.
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

  // ── Auto-speak newly revealed narration ──────────────────────────
  useEffect(() => {
    tts.autoSpeak(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on narration/TTS-flag changes only; `tts` is a fresh object each render and would loop
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately fires only when the ambience level changes; reads current phase/premise/refs at run time
  }, [ambience.ambienceLevel]);

  // ── Auto-abort a request that was left stale in the background ────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the banner value; `saves` is a fresh object each render and the stable setter is read at run time
  }, [saves.saveBanner]);

  // ── Game actions ─────────────────────────────────────────────────
  const skipReveal = () => dispatch({ type: "SKIP_REVEAL" });

  const finalizeNarration = (
    narration: string,
    gmParsed: RecoveryGMParsed,
    baseEntries: Entry[],
    baseHistory: ChatMessage[],
    fullyRevealed: boolean
  ) => {
    const assistantPayload = JSON.stringify({ gm_scratchpad: "", narration, state: gmParsed.state, ending: gmParsed.ending });
    const newHistory = [...baseHistory, { role: "assistant" as const, content: assistantPayload }];
    const shouldUpdateState = gmParsed.state && !(isStateEmpty(gmParsed.state) && !isStateEmpty(s.gameState));
    dispatch({
      type: "STREAM_FINALIZE",
      narrationIndex: baseEntries.length,
      text: narration,
      fullyRevealed,
      history: newHistory,
      gameState: shouldUpdateState ? gmParsed.state : undefined,
      ended: !!gmParsed.ending,
    });
    if (gmParsed.ending) {
      progress.recordEnding(s.premise?.id, gmParsed.ending);
    }
  };

  const beginAdventure = async (chosen: Premise): Promise<void> => {
    codex.revokeAllPlates(entries);
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    dispatch({ type: "START_GAME", premise: chosen });
    codex.resetCodex();
    setLoadingPhrase(pickPhrase(OPENING_LOADING_PHRASES));
    setLoading(true);
    await ensureAmbienceEngine();
    const controller = new AbortController;
    const rollback = () => {
      dispatch({ type: "SET_PHASE", phase: "title" });
      dispatch({ type: "SET_PREMISE", premise: null });
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const sys = buildSystem(chosen, language);
      const msgs: ChatMessage[] = [{ role: "user", content: "Begin." }];
      const bootstrapPromise = codex.runArtDirectorBootstrap(chosen, controller.signal);
      const firstRaw = await callAPI(sys, msgs, true, settings.engineOpening, 4500, 0.7, controller.signal);
      bootstrapPromise.catch(() => {});
      if (controller.signal.aborted) return;
      let openingRaw = firstRaw;
      let parsed = parseGMResponse(openingRaw);
      if (parsed.malformed) {
        const priorAssistant = (openingRaw && openingRaw.trim()) ? openingRaw : "(empty response)";
        const correctiveMsgs: ChatMessage[] = [
          ...msgs,
          { role: "assistant", content: priorAssistant },
          { role: "user", content: `Your previous response could not be parsed. Reason: ${parsed.diagnostic || "missing required fields"}.

Call the tool \`narrate_and_update_state\` again. Required top-level fields: gm_scratchpad (string, keep it brief — under 120 words), narration (string, non-empty, the prose the player reads), state (object with: scene, time, inventory, npcs, clues, summary, hidden_state). Output ONLY the tool call / JSON object — no prose, no markdown fences.` }
        ];
        const retryRaw = await callAPI(sys, correctiveMsgs, true, settings.engineOpening, 7500, 0.4, controller.signal);
        if (controller.signal.aborted) return;
        openingRaw = retryRaw;
        parsed = parseGMResponse(openingRaw);
      }
      if (parsed.malformed) {
        const err = new BorrowedError("The hour stumbles in opening. Try once more.", parsed.diagnostic || "Tool response was malformed (likely truncated by max_tokens or missing required fields).");
        if (parsed.raw) err.raw = parsed.raw;
        throw err;
      }
      dispatch({
        type: "APPEND_TURN",
        entries: [{ type: "narration", text: parsed.narration, fullyRevealed: false }],
        history: [...msgs, { role: "assistant", content: openingRaw }],
        gameState: parsed.state,
        ended: !!parsed.ending,
      });
      if (parsed.ending) {
        progress.recordEnding(chosen.id, parsed.ending);
      }
      if (ambienceRef.current) {
        const bed = (chosen.realm === "wild" && chosen.seed)
          ? deriveAmbienceFromSeed(chosen.seed)
          : defaultAmbienceForRealm(chosen.realm);
        ambienceRef.current.applyAmbience(bed);
        if (parsed.ambience !== undefined)
          ambienceRef.current.applyAmbience(parsed.ambience);
      }
      if ((settings.codex?.mode || "off") !== "off") {
        bootstrapPromise.then(() => {
          if (controller.signal.aborted) return;
          return codex.runArtDirectorTurn({
            entryIndexProvider: () => 0,
            gmParsed: { state: parsed.state, narrator_brief: parsed.narration },
            signal: controller.signal,
            opener: true
          });
        }).catch(() => {});
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
      if (!cancelled) dispatch({ type: "SET_ERROR", error: formatError(e) });
      rollback();
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  const continueNarration = async () => {
    const rec = recovery;
    if (!rec || loading) return;
    dispatch({ type: "SET_ERROR", error: null });
    dispatch({ type: "SET_RECOVERY", recovery: null });
    setLoadingPhrase(pickPhrase(NARRATION_LOADING_PHRASES));
    setLoading(true);
    let acc = rec.partial;
    const controller = new AbortController;
    const rollback = () => {
      finalizeNarration(rec.partial, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
      dispatch({ type: "SET_RECOVERY", recovery: rec });
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    const continuePrompt = `${rec.narratorPrompt}

[Partial narration already shown to the player]
${rec.partial}

The narration above was interrupted and cut off before it finished. Continue it seamlessly from exactly where it stops — do not repeat or restate any of it, do not open a new scene. Write only the continuation, carrying the same passage to a natural close.`;
    streamingStore.reset();
    streamingStore.emit(rec.partial);
    const onDelta = (chunk: string) => {
      acc += chunk;
      streamingStore.emit(acc);
    };
    dispatch({ type: "SET_ENTRIES", entries: [...rec.baseEntries, { type: "narration", text: "", streaming: true, fullyRevealed: false }] });
    try {
      await streamAPI(rec.narratorSys, [{ role: "user", content: continuePrompt }], settings.engineNarrator, 700, 0.8, controller.signal, onDelta);
      if (controller.signal.aborted) return;
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return;
      dispatch({ type: "SET_ERROR", error: formatError(e) });
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
      dispatch({ type: "SET_RECOVERY", recovery: { ...rec, partial: acc } });
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  /**
   * Process one turn. The composer owns the input text and passes it in.
   * Returns false when the input should be restored.
   */
  const submit = async (text: string): Promise<boolean> => {
    text = (text || "").trim();
    if (!text || loading) return true;
    if (!metaMode && ended) return true;
    if (!premise) return true;
    skipReveal();
    dispatch({ type: "SET_RECOVERY", recovery: null });
    if (!metaMode) await ensureAmbienceEngine();
    if (metaMode) {
      const previousMeta = metaMessages;
      const newMeta: MetaMessage[] = [
        ...metaMessages,
        { role: "user", text, fullyRevealed: true }
      ];
      dispatch({ type: "SET_META_MESSAGES", metaMessages: newMeta });
      setLoadingPhrase(pickPhrase(META_LOADING_PHRASES));
      setLoading(true);
      dispatch({ type: "SET_ERROR", error: null });
      const controller2 = new AbortController;
      const rollback2 = () => {
        dispatch({ type: "SET_META_MESSAGES", metaMessages: previousMeta });
      };
      abortRef.current = { controller: controller2, rollback: rollback2, startedAt: Date.now() };
      try {
        const sys = buildMetaSystem(premise, language);
        const chronicleParts = [];
        for (const h of history) {
          if (h.role === "user") {
            const m = h.content.match(/\[Player action\]\s*\n?([\s\S]*)$/);
            const action = m ? m[1].trim() : h.content.trim();
            if (action) chronicleParts.push(`[Player] ${action}`);
            else chronicleParts.push(`[Player] (Begin)`);
          } else {
            const parsed = parseGMResponse(h.content);
            chronicleParts.push(`[GM] ${parsed.narration}`);
          }
        }
        const MAX_PARTS = 60;
        let trimmedNote = "";
        let kept = chronicleParts;
        if (chronicleParts.length > MAX_PARTS) {
          const head = chronicleParts.slice(0, 4);
          const tail = chronicleParts.slice(-(MAX_PARTS - 4));
          kept = [...head, ...tail];
          trimmedNote = `\n\n[Note: middle of chronicle abridged for length — ${chronicleParts.length - kept.length} turns omitted between the opening and the recent passages.]`;
        }
        const { publicBlock: publicBlock2, privateBlock: privateBlock2 } = formatStateForPrompt(gameState);
        const finalState = privateBlock2 ? `${publicBlock2}\n\n${privateBlock2}` : publicBlock2;
        const chronicleText = kept.join("\n\n") + trimmedNote;
        const metaApiMessages: ChatMessage[] = [
          {
            role: "user",
            content: `For your reference, the full chronicle we just played:\n\n${chronicleText}\n\n— end of chronicle —\n\nFinal game state at the close:\n\n${finalState}`
          },
          {
            role: "assistant",
            content: "I have the chronicle in mind. I'm ready to talk about it with you."
          },
          ...newMeta.map((m) => ({ role: m.role, content: m.text }))
        ];
        const reply = await callAPI(sys, metaApiMessages, false, settings.engineNarrator, 3000, 0.8, controller2.signal);
        if (controller2.signal.aborted) return false;
        dispatch({ type: "SET_META_MESSAGES", metaMessages: [
          ...newMeta,
          { role: "assistant", text: reply, fullyRevealed: false }
        ] });
        return true;
      } catch (e) {
        if (controller2.signal.aborted) return false;
        const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
        if (!cancelled) dispatch({ type: "SET_ERROR", error: formatError(e) });
        rollback2();
        return false;
      } finally {
        if (abortRef.current?.controller === controller2) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    }
    const previousEntries = entries;
    const previousHistory = history;
    const newEntries: Entry[] = [...entries, { type: "action", text, fullyRevealed: true }];
    dispatch({ type: "SET_ENTRIES", entries: newEntries });
    if (tts.ttsRef.current) tts.ttsRef.current.stop();
    const { publicBlock, privateBlock } = formatStateForPrompt(gameState);
    const parts: string[] = [];
    if (publicBlock) parts.push(publicBlock);
    parts.push(`[Player action]\n${text}`);
    if (privateBlock) parts.push(privateBlock);
    const playerMessage = parts.join("\n\n");
    const newHistory: ChatMessage[] = [...history, { role: "user", content: playerMessage }];
    const tailStart = newHistory.length - 1;
    let apiHistory = newHistory.map((msg, i) => {
      if (i >= tailStart) return msg;
      return msg.role === "user" ? { ...msg, content: stripHistoricalUser(msg.content) } : { ...msg, content: stripHistoricalAssistant(msg.content) };
    });
    const FLUSH_THRESHOLD = 16;
    const FLUSH_SIZE = 8;
    let currentFrozen = frozenPrefixLength;
    if (apiHistory.length - currentFrozen > FLUSH_THRESHOLD) {
      currentFrozen += FLUSH_SIZE;
      dispatch({ type: "SET_FROZEN_PREFIX", length: currentFrozen });
    }
    const CHAR_CAP = settings.engineGM?.provider === "groq" ? 60000 : 80000;
    const charsOf = (msgs: ChatMessage[]) => msgs.reduce((sum: number, m: ChatMessage) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
    if (charsOf(apiHistory) > CHAR_CAP) {
      const beforeLen = apiHistory.length;
      const head = apiHistory.slice(0, 2);
      let tail = apiHistory.slice(2);
      while (tail.length > 4 && charsOf([...head, ...tail]) > CHAR_CAP) {
        tail = tail.slice(2);
      }
      apiHistory = [...head, ...tail];
      const removed = beforeLen - apiHistory.length;
      currentFrozen = Math.max(0, currentFrozen - removed);
    }
    const cacheBreakpoint = currentFrozen > 0 ? currentFrozen : undefined;
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[borrowed] apiHistory", {
        msgs: apiHistory.length,
        chars: charsOf(apiHistory),
        estTokens: Math.round(charsOf(apiHistory) / 4),
        frozenPrefix: currentFrozen
      });
    }
    dispatch({ type: "SET_HISTORY", history: newHistory });
    setLoadingPhrase(pickPhrase(NARRATION_LOADING_PHRASES));
    setLoading(true);
    dispatch({ type: "SET_ERROR", error: null });
    const controller = new AbortController;
    const rollback = () => {
      dispatch({ type: "SET_ENTRIES", entries: previousEntries });
      dispatch({ type: "SET_HISTORY", history: previousHistory });
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const gmSys = buildSystem(premise, language, { split: true });
      const firstGmReply = await callAPI(gmSys, apiHistory, true, settings.engineGM, 2600, 0.35, controller.signal, GM_LOGIC_TOOL, cacheBreakpoint);
      if (controller.signal.aborted) return false;
      let gmReply = firstGmReply;
      let gmParsed = parseGMLogicResponse(gmReply);
      if (gmParsed.malformed) {
        const priorAssistant = (gmReply && gmReply.trim()) ? gmReply : "(empty response)";
        const correctiveHistory: ChatMessage[] = [
          ...apiHistory,
          { role: "assistant", content: priorAssistant },
          { role: "user", content: `Your previous response could not be parsed. Reason: ${gmParsed.diagnostic || "missing required fields"}.

Call the tool \`gm_decide\` again. Required top-level fields: gm_scratchpad (string, keep it brief — under 120 words), narrator_brief (string, non-empty, the compressed brief for the narrator), state (object with two sub-objects: ledger { scene, time, inventory, npcs, clues, summary } and hidden_state (string)). Optional: ending. Output ONLY the tool call / JSON object — no prose, no markdown fences.` }
        ];
        const retryGmReply = await callAPI(gmSys, correctiveHistory, true, settings.engineGM, 3600, 0.25, controller.signal, GM_LOGIC_TOOL);
        if (controller.signal.aborted) return false;
        gmReply = retryGmReply;
        gmParsed = parseGMLogicResponse(gmReply);
      }
      if (gmParsed.malformed) {
        const err = new BorrowedError("The hour stumbles. Try once more.", gmParsed.diagnostic || "GM logic response was malformed.");
        if (gmParsed.raw) err.raw = gmParsed.raw;
        throw err;
      }
      if (ambienceRef.current && gmParsed.ambience !== undefined)
        ambienceRef.current.applyAmbience(gmParsed.ambience);
      const artDirectorPromise = codex.runArtDirectorTurn({
        entryIndexProvider: () => newEntries.length,
        gmParsed,
        signal: controller.signal
      });
      artDirectorPromise.catch(() => {});
      const narratorSys = buildNarratorSystem(premise, language);
      const recentNarration = entries.filter((e) => e.type === "narration").slice(-4).map((e) => e.text).join("\n\n");
      const narratorPrompt = `[State]\n${serializeStatePublic(gmParsed.state)}\n\n[Narrator brief]\n${gmParsed.narrator_brief}\n\n[Recent narration]\n${recentNarration}`;
      if (settings.streamNarration) {
        const narrationIndex = newEntries.length;
        let acc = "";
        streamingStore.reset();
        dispatch({ type: "UPDATE_ENTRIES", updater: (prev) => {
          const existing = prev[narrationIndex];
          const entry: NarrationEntry = { type: "narration", text: "", streaming: true, fullyRevealed: false };
          if (existing && existing.illustration) entry.illustration = existing.illustration;
          return [...newEntries, entry];
        } });
        const onDelta = (chunk: string) => {
          acc += chunk;
          streamingStore.emit(acc);
        };
        let narration;
        try {
          narration = await streamAPI(narratorSys, [{ role: "user", content: narratorPrompt }], settings.engineNarrator, 1200, 0.8, controller.signal, onDelta);
        } catch (e) {
          if (controller.signal.aborted) return false;
          if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return false;
          const caught = e as ThrownError;
          if (caught && typeof caught.partial === "string" && caught.partial) {
            finalizeNarration(caught.partial, gmParsed, newEntries, newHistory, true);
            dispatch({ type: "SET_ERROR", error: formatError(e) });
            dispatch({ type: "SET_RECOVERY", recovery: {
              narratorSys, narratorPrompt, gmParsed,
              baseEntries: newEntries, baseHistory: newHistory,
              partial: caught.partial
            } });
            return true;
          }
          throw e;
        }
        if (controller.signal.aborted) return false;
        finalizeNarration(narration, gmParsed, newEntries, newHistory, true);
      } else {
        const narration = await callAPI(narratorSys, [{ role: "user", content: narratorPrompt }], false, settings.engineNarrator, 1200, 0.8, controller.signal);
        if (controller.signal.aborted) return false;
        finalizeNarration(narration, gmParsed, newEntries, newHistory, false);
      }
      return true;
    } catch (e) {
      if (controller.signal.aborted) return false;
      const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
      if (!cancelled) dispatch({ type: "SET_ERROR", error: formatError(e) });
      rollback();
      return false;
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  const cancelRequest = () => {
    const ref = abortRef.current;
    if (!ref) return;
    const { controller, rollback } = ref;
    abortRef.current = null;
    setLoading(false);
    dispatch({ type: "SET_ERROR", error: null });
    try { rollback?.(); } catch {}
    if (controller && !controller.signal.aborted) {
      try { controller.abort(); } catch {}
    }
  };

  const canUndo = !loading && !metaMode && history.length >= 4 && entries.length >= 3;

  const undoLastTurn = () => {
    if (!canUndo) return;
    const newHistory = history.slice(0, -2);
    const newEntries = entries.slice(0, -2);
    let newState = EMPTY_STATE;
    const lastAssistant = [...newHistory].reverse().find((h) => h.role === "assistant");
    if (lastAssistant) {
      const parsed = parseGMResponse(lastAssistant.content);
      if (parsed.state) newState = parsed.state;
    }
    dispatch({ type: "UNDO", entries: newEntries, history: newHistory, gameState: newState });
    saves.setSaveBanner({ kind: "ok", text: "The last turn is unmade." });
  };

  const enterMetaMode = () => dispatch({ type: "ENTER_META" });

  const exitMetaMode = () => dispatch({ type: "EXIT_META" });

  const restart = () => {
    codex.revokeAllPlates(entries);
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    dispatch({ type: "RESET" });
    reveal.resetReveal();
    keepsake.resetKeepsake();
    if (ambienceRef.current) ambienceRef.current.applyAmbience(null);
    tts.stopTTS();
    tts.resetTTSCursor(0);
    codex.resetCodex();
  };

  const loadSave = async (save: SaveRecord) => {
    let found = null;
    if (save.isCustom && save.premise) {
      found = save.premise;
    } else {
      found = PREMISES.find((p) => p.id === save.premiseId) || save.premise || null;
    }
    if (!found) {
      saves.setSaveBanner({ kind: "err", text: "This hour is no longer here." });
      return;
    }
    codex.revokeAllPlates(entries);
    tts.stopTTS();
    tts.resetTTSCursor((save.entries || []).length);
    const rawEntries: Entry[] = (save.entries || []).map((e) => ({ ...e, fullyRevealed: true }));
    dispatch({
      type: "LOAD_SAVE",
      payload: {
        premise: found,
        entries: rawEntries,
        history: save.history || [],
        ended: !!save.ended,
        gameState: save.gameState || EMPTY_STATE,
        language: save.language || "en",
        metaMessages: (save.metaMessages || []).map((m) => ({ ...m, fullyRevealed: true })),
        metaMode: !!save.metaMode,
      },
    });
    // Rehydrate illustrations: entries whose url is an `idb:` marker have their
    // bytes in IndexedDB. Pull each Blob, mint a live `blob:` URL, and swap it in.
    (async () => {
      const rehydrated = await Promise.all(rawEntries.map(async (e): Promise<Entry> => {
        const ill = e.illustration;
        if (!ill || typeof ill.url !== "string" || !ill.url.startsWith("idb:")) return e;
        const imgKey = ill.url.slice("idb:".length);
        const blob = await getImage(imgKey);
        if (!blob) return { ...e, illustration: { ...ill, status: "failed", url: undefined } };
        return { ...e, illustration: { ...ill, url: URL.createObjectURL(blob) } };
      }));
      dispatch({ type: "SET_ENTRIES", entries: rehydrated });
    })();
    codex.restoreCodex(save.codex);
    reveal.resetReveal();
    keepsake.resetKeepsake();
    saves.setShowSaves(false);
    saves.setSaveBanner({ kind: "ok", text: "The hour resumes." });
    await ensureAmbienceEngine();
    if (ambienceRef.current) {
      const bed = (found.realm === "wild" && found.seed)
        ? deriveAmbienceFromSeed(found.seed)
        : defaultAmbienceForRealm(found.realm);
      ambienceRef.current.applyAmbience(bed);
    }
  };

  const saveCurrent = () => saves.saveCurrent({
    premise, entries, ended, gameState, history, metaMessages, metaMode, language,
    codex: { styleBible: codex.styleBible, visualLedger: codex.visualLedger, plateCount: codex.plateCount }
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
      premise, entries, revealText: reveal.revealText, metaMessages, ended
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

  const entriesCount = entries.length;
  const hasMeta = metaMessages.length > 0;

  // ── Stable action surface ────────────────────────────────────────────────
  // The action closures are rebuilt every render (so they always read fresh
  // state), but we expose them through stable wrappers that read the latest
  // closures from a ref. The wrappers' identities never change, so the actions
  // object can be memoized once — dispatch-only consumers (e.g. the composer)
  // stop re-rendering on narration churn, with no stale-closure hazard.
  const setLanguage = (lang: React.SetStateAction<string>) => {
    const resolved = typeof lang === "function" ? lang(s.language) : lang;
    dispatch({ type: "SET_LANGUAGE", language: resolved });
  };
  const liveActions: GameActions = {
    setLanguage, beginAdventure, submit, continueNarration,
    undoLastTurn, restart, loadSave,
    enterMetaMode, exitMetaMode,
    skipReveal, cancelRequest,
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
    // Build the key list once (action names are stable), but every forwarder
    // MUST dereference liveActionsRef.current at CALL TIME so it runs the latest
    // closure — capturing `liveActionsRef.current` in a const here would freeze
    // every action to the first render (premise=null, phase="title").
    for (const name of Object.keys(liveActionsRef.current)) {
      out[name] = (...args: unknown[]) =>
        (liveActionsRef.current as unknown as Record<string, (...args: unknown[]) => unknown>)[name](...args);
    }
    return out as unknown as GameActions;
  }, [liveActionsRef]);

  // ── Low-churn story state ────────────────────────────────────────────────
  // `entriesCount`/`hasMeta`/`canUndo` are derived but only change per turn, so
  // memoizing on the derived values (not the array identities) keeps this stable
  // across the per-delta `entries`/`metaMessages` updates during streaming.
  const story: GameStoryValue = useMemo(() => ({
    phase, premise, language, ended, metaMode,
    canUndo, entriesCount, hasMeta, keepsakeFilename,
  }), [phase, premise, language, ended, metaMode, canUndo, entriesCount, hasMeta, keepsakeFilename]);

  // ── High-churn live state + saves/reveal/keepsake surfaces ───────────────
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

  // ── Transient runtime state ──────────────────────────────────────────────
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
