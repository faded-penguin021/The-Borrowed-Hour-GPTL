import type { ChatMessage, Entry, MetaMessage, NarrationEntry, Premise, SaveRecord, ThrownError, AppSettings, SaveBanner } from "../types";
import type { CallAPI, StreamAPI } from "../llm/client";
import type { StoryAction, StoryState, RecoveryGMParsed, StreamingStore } from "./storyReducer";
import type { CodexSnapshot } from "../types";
import { EMPTY_STATE } from "../data/constants";
import { PREMISES, NARRATION_LOADING_PHRASES, META_LOADING_PHRASES, OPENING_LOADING_PHRASES, pickPhrase } from "../data/premises";
import { buildGMLogicTool, buildGMTool, buildSystem, buildNarratorSystem, buildMetaSystem } from "../llm/tools";
import { parseGMResponse, parseGMLogicResponse, isStateEmpty } from "../llm/parse";
import { formatStateForPrompt, stripHistoricalUser, stripHistoricalAssistant, serializeStatePublic } from "../llm/prompt";
import { formatError, BorrowedError } from "../llm/errors";
import { defaultAmbienceForRealm, deriveAmbienceFromSeed } from "../ambience/tables";
import { getImage } from "../storage/imageStore";
import { migrateSave } from "../saves/migrate";
import { dlog } from "../debug/debugLog";

import type { AmbienceInput } from "../types";

export type AbortRef = { controller: AbortController; rollback?: () => void; startedAt: number };

interface AmbienceHandle {
  applyAmbience: (input: AmbienceInput | null | undefined) => void;
}

export interface GameLoopDeps {
  getState: () => StoryState;
  getSettings: () => AppSettings;
  getLoading: () => boolean;

  dispatch: (action: StoryAction) => void;
  setLoading: (v: boolean) => void;
  setLoadingPhrase: (v: string) => void;
  resetSessionTokens: () => void;

  abortRef: { current: AbortRef | null };
  streamingStore: StreamingStore;
  callAPI: CallAPI;
  streamAPI: StreamAPI;

  codex: {
    revokeAllPlates: (entries: Entry[]) => void;
    resetCodex: () => void;
    restoreCodex: (snapshot: CodexSnapshot | null | undefined) => void;
    runArtDirectorBootstrap: (premise: Premise, signal: AbortSignal) => Promise<void>;
    runArtDirectorTurn: (args: {
      entryIndexProvider: () => number;
      gmParsed: RecoveryGMParsed;
      signal: AbortSignal;
      opener?: boolean;
    }) => Promise<void>;
  };

  saves: {
    setSaveBanner: (banner: SaveBanner | null) => void;
    clearAutosave: () => void;
    setShowSaves: (show: boolean) => void;
    readAutosave: () => Promise<SaveRecord | null>;
  };

  progress: {
    recordEnding: (premiseId: string | null | undefined, ending: string) => void;
  };

  tts: {
    ttsRef: { current: { stop: () => void } | null };
    stopTTS: () => void;
    resetTTSCursor: (position: number) => void;
  };

  ambience: {
    ensureAmbienceEngine: () => Promise<AmbienceHandle | null>;
    ambienceRef: { current: AmbienceHandle | null };
    // True when the user has ambience enabled in settings (level !== "off").
    // Drives the conditional ambience block in buildSystem and the matching
    // schema field on the GM tools — when false, the model is never briefed on
    // the ambience field and the schema does not advertise it.
    ambienceEnabled: boolean;
  };

  reveal: {
    resetReveal: () => void;
  };

  keepsake: {
    resetKeepsake: () => void;
  };
}

export function createGameLoop(deps: GameLoopDeps) {
  const {
    dispatch, setLoading, setLoadingPhrase,
    abortRef, streamingStore,
    callAPI, streamAPI,
  } = deps;

  // Synchronous one-run-at-a-time latch. The React `loading` flag only flips
  // on the next render, and both beginAdventure and submit await ambience
  // setup before setting it, so two clicks in that window would race two
  // overlapping turns (double API spend, interleaved history dispatches).
  // `runSeq` lets cancelRequest release the latch immediately without the
  // cancelled run's finally stomping a newer run's latch when it resumes.
  let inFlight = false;
  let runSeq = 0;

  function exclusive<A extends unknown[], R>(fn: (...args: A) => Promise<R>, blockedResult: R) {
    return async (...args: A): Promise<R> => {
      if (inFlight) return blockedResult;
      const myRun = ++runSeq;
      inFlight = true;
      try {
        return await fn(...args);
      } finally {
        if (runSeq === myRun) inFlight = false;
      }
    };
  }

  function finalizeNarration(
    narration: string,
    gmParsed: RecoveryGMParsed,
    baseEntries: Entry[],
    baseHistory: ChatMessage[],
    fullyRevealed: boolean,
  ) {
    const s = deps.getState();
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
      deps.progress.recordEnding(s.premise?.id, gmParsed.ending);
    }
  }

  async function beginAdventure(chosen: Premise): Promise<void> {
    const s = deps.getState();
    const settings = deps.getSettings();
    deps.codex.revokeAllPlates(s.entries);
    deps.resetSessionTokens();
    dispatch({ type: "START_GAME", premise: chosen });
    deps.saves.clearAutosave();
    deps.codex.resetCodex();
    setLoadingPhrase(pickPhrase(OPENING_LOADING_PHRASES));
    setLoading(true);
    await deps.ambience.ensureAmbienceEngine();
    const controller = new AbortController;
    const rollback = () => {
      dispatch({ type: "SET_PHASE", phase: "title" });
      dispatch({ type: "SET_PREMISE", premise: null });
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const ambienceOn = deps.ambience.ambienceEnabled;
      const sys = buildSystem(chosen, s.language, { ambience: ambienceOn });
      const openingTool = buildGMTool({ ambience: ambienceOn });
      dlog("prompt:opening:system", sys.length, "chars");
      const beginParts: string[] = [];
      if (chosen.briefing) {
        beginParts.push(`[Character knowledge]\n${chosen.briefing}`);
      }
      beginParts.push("Begin.");
      const msgs: ChatMessage[] = [{ role: "user", content: beginParts.join("\n\n") }];
      const codexOn = (settings.codex?.mode || "off") !== "off";
      const bootstrapPromise = codexOn
        ? deps.codex.runArtDirectorBootstrap(chosen, controller.signal)
        : Promise.resolve();
      const firstRaw = await callAPI(sys, msgs, true, settings.engineOpening, 4500, 0.7, controller.signal, openingTool);
      bootstrapPromise.catch((e) => { dlog("codex:bootstrap:swallowed", e); });
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
        const retryRaw = await callAPI(sys, correctiveMsgs, true, settings.engineOpening, 7500, 0.4, controller.signal, openingTool);
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
        deps.progress.recordEnding(chosen.id, parsed.ending);
      }
      if (deps.ambience.ambienceRef.current) {
        const bed = (chosen.realm === "wild" && chosen.seed)
          ? deriveAmbienceFromSeed(chosen.seed)
          : defaultAmbienceForRealm(chosen.realm);
        deps.ambience.ambienceRef.current.applyAmbience(bed);
        if (parsed.ambience !== undefined)
          deps.ambience.ambienceRef.current.applyAmbience(parsed.ambience);
      }
      if (codexOn) {
        bootstrapPromise.then(() => {
          if (controller.signal.aborted) return;
          return deps.codex.runArtDirectorTurn({
            entryIndexProvider: () => 0,
            gmParsed: { state: parsed.state, narrator_brief: parsed.narration },
            signal: controller.signal,
            opener: true
          });
        }).catch((e) => { dlog("codex:opener-turn:swallowed", e); });
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
  }

  async function continueNarration(): Promise<void> {
    const s = deps.getState();
    const settings = deps.getSettings();
    const rec = s.recovery;
    if (!rec || deps.getLoading()) return;
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
  }

  async function submit(text: string): Promise<boolean> {
    text = (text || "").trim();
    const s = deps.getState();
    const settings = deps.getSettings();
    const loading = deps.getLoading();
    if (!text || loading) return true;
    if (!s.metaMode && s.ended) return true;
    if (!s.premise) return true;
    dispatch({ type: "SKIP_REVEAL" });
    dispatch({ type: "SET_RECOVERY", recovery: null });
    if (!s.metaMode) await deps.ambience.ensureAmbienceEngine();

    if (s.metaMode) {
      const previousMeta = s.metaMessages;
      const newMeta: MetaMessage[] = [
        ...s.metaMessages,
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
        let resolvedEnding: string | null = null;
        for (let i = s.history.length - 1; i >= 0; i--) {
          if (s.history[i].role === "assistant") {
            const ep = parseGMResponse(s.history[i].content);
            if (ep.ending) { resolvedEnding = ep.ending; break; }
          }
        }
        const sys = buildMetaSystem(s.premise, s.language, resolvedEnding);
        dlog("prompt:meta:system", sys.length, "chars", "ending:", resolvedEnding);
        const chronicleParts = [];
        for (const h of s.history) {
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
        const { publicBlock: publicBlock2, privateBlock: privateBlock2 } = formatStateForPrompt(s.gameState);
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

    const previousEntries = s.entries;
    const previousHistory = s.history;
    const newEntries: Entry[] = [...s.entries, { type: "action", text, fullyRevealed: true }];
    dispatch({ type: "SET_ENTRIES", entries: newEntries });
    if (deps.tts.ttsRef.current) deps.tts.ttsRef.current.stop();
    const { publicBlock, privateBlock } = formatStateForPrompt(s.gameState);
    const parts: string[] = [];
    if (publicBlock) parts.push(publicBlock);
    parts.push(`[Player action]\n${text}`);
    if (privateBlock) parts.push(privateBlock);
    const playerMessage = parts.join("\n\n");
    const newHistory: ChatMessage[] = [...s.history, { role: "user", content: playerMessage }];
    const tailStart = newHistory.length - 1;
    let apiHistory = newHistory.map((msg, i) => {
      if (i >= tailStart) return msg;
      return msg.role === "user" ? { ...msg, content: stripHistoricalUser(msg.content) } : { ...msg, content: stripHistoricalAssistant(msg.content) };
    });
    const FLUSH_THRESHOLD = 16;
    const FLUSH_SIZE = 8;
    let currentFrozen = s.frozenPrefixLength;
    if (apiHistory.length - currentFrozen > FLUSH_THRESHOLD) {
      currentFrozen += FLUSH_SIZE;
      dispatch({ type: "SET_FROZEN_PREFIX", length: currentFrozen });
    }
    const CHAR_CAP = settings.engineGM?.provider === "groq" ? 60000 : 80000;
    const charsOf = (msgs: ChatMessage[]) => msgs.reduce((sum: number, m: ChatMessage) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
    const HEAD_KEEP = 2;
    const MIN_TAIL = 4;
    const PRUNE_BATCH = 20;
    const maxDroppable = Math.max(0, apiHistory.length - HEAD_KEEP - MIN_TAIL);
    const applyDrop = (n: number): ChatMessage[] =>
      n > 0 ? [...apiHistory.slice(0, HEAD_KEEP), ...apiHistory.slice(HEAD_KEEP + n)] : apiHistory;
    let dropped = Math.min(s.prunedPrefixLength, maxDroppable);
    while (dropped < maxDroppable && charsOf(applyDrop(dropped)) > CHAR_CAP) {
      dropped = Math.min(dropped + PRUNE_BATCH, maxDroppable);
    }
    if (dropped !== s.prunedPrefixLength) {
      dispatch({ type: "SET_PRUNED_PREFIX", length: dropped });
    }
    if (dropped > 0) {
      apiHistory = applyDrop(dropped);
      currentFrozen = Math.max(0, currentFrozen - dropped);
    }
    const cacheBreakpoint = currentFrozen > 0 ? currentFrozen : undefined;
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[borrowed] apiHistory", {
        msgs: apiHistory.length,
        chars: charsOf(apiHistory),
        estTokens: Math.round(charsOf(apiHistory) / 4),
        frozenPrefix: currentFrozen,
        prunedPrefix: dropped
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
      const ambienceOn = deps.ambience.ambienceEnabled;
      const gmSys = buildSystem(s.premise, s.language, { split: true, ambience: ambienceOn });
      const gmLogicTool = buildGMLogicTool({ ambience: ambienceOn });
      dlog("prompt:gm:system", gmSys.length, "chars");
      dlog("prompt:gm:history", apiHistory.length, "msgs");
      const firstGmReply = await callAPI(gmSys, apiHistory, true, settings.engineGM, 2600, 0.35, controller.signal, gmLogicTool, cacheBreakpoint, s.premise?.id);
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
        const retryGmReply = await callAPI(gmSys, correctiveHistory, true, settings.engineGM, 3600, 0.25, controller.signal, gmLogicTool);
        if (controller.signal.aborted) return false;
        gmReply = retryGmReply;
        gmParsed = parseGMLogicResponse(gmReply);
      }
      if (gmParsed.malformed) {
        const err = new BorrowedError("The hour stumbles. Try once more.", gmParsed.diagnostic || "GM logic response was malformed.");
        if (gmParsed.raw) err.raw = gmParsed.raw;
        throw err;
      }
      if (deps.ambience.ambienceRef.current && gmParsed.ambience !== undefined)
        deps.ambience.ambienceRef.current.applyAmbience(gmParsed.ambience);
      if ((settings.codex?.mode || "off") !== "off") {
        const artDirectorPromise = deps.codex.runArtDirectorTurn({
          entryIndexProvider: () => newEntries.length,
          gmParsed,
          signal: controller.signal
        });
        artDirectorPromise.catch((e) => { dlog("codex:turn:swallowed", e); });
      }
      const narratorSys = buildNarratorSystem(s.premise, s.language);
      dlog("prompt:narrator:system", narratorSys.length, "chars");
      const recentNarration = s.entries.filter((e) => e.type === "narration").slice(-4).map((e) => e.text).join("\n\n");
      const narratorPrompt = `[State]\n${serializeStatePublic(gmParsed.state)}\n\n[Narrator brief]\n${gmParsed.narrator_brief}\n\n[Recent narration]\n${recentNarration}`;
      dlog("prompt:narrator:brief", gmParsed.narrator_brief.slice(0, 300));
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
  }

  function cancelRequest() {
    const ref = abortRef.current;
    if (!ref) return;
    const { controller, rollback } = ref;
    abortRef.current = null;
    // Release the latch now rather than when the cancelled run's finally
    // resumes; bumping runSeq keeps that finally from stomping a newer run.
    runSeq++;
    inFlight = false;
    setLoading(false);
    dispatch({ type: "SET_ERROR", error: null });
    try { rollback?.(); } catch {}
    if (controller && !controller.signal.aborted) {
      try { controller.abort(); } catch {}
    }
  }

  function undoLastTurn() {
    const s = deps.getState();
    const loading = deps.getLoading();
    const canUndo = !inFlight && !loading && !s.metaMode && s.history.length >= 4 && s.entries.length >= 3;
    if (!canUndo) return;
    const newHistory = s.history.slice(0, -2);
    const newEntries = s.entries.slice(0, -2);
    let newState = EMPTY_STATE;
    const lastAssistant = [...newHistory].reverse().find((h) => h.role === "assistant");
    if (lastAssistant) {
      const parsed = parseGMResponse(lastAssistant.content);
      if (parsed.state) newState = parsed.state;
    }
    dispatch({ type: "UNDO", entries: newEntries, history: newHistory, gameState: newState });
    deps.saves.setSaveBanner({ kind: "ok", text: "The last turn is unmade." });
  }

  function restart() {
    const s = deps.getState();
    deps.codex.revokeAllPlates(s.entries);
    deps.resetSessionTokens();
    dispatch({ type: "RESET" });
    deps.reveal.resetReveal();
    deps.keepsake.resetKeepsake();
    if (deps.ambience.ambienceRef.current) deps.ambience.ambienceRef.current.applyAmbience(null);
    deps.tts.stopTTS();
    deps.tts.resetTTSCursor(0);
    deps.codex.resetCodex();
  }

  async function loadSave(rawSave: SaveRecord): Promise<void> {
    try {
      await loadSaveUnguarded(rawSave);
    } catch (e) {
      // A record damaged beyond what migrateSave normalizes (or a storage
      // read failing mid-load) degrades to a banner, never a crash.
      dlog("saves:load-error", e);
      deps.saves.setSaveBanner({ kind: "err", text: "This hour cannot be taken up — the record is damaged." });
    }
  }

  async function loadSaveUnguarded(rawSave: SaveRecord): Promise<void> {
    // Loading over an in-flight turn: cancel it (abort + rollback) so its
    // finalize can't later clobber the loaded game's entries/history.
    if (inFlight || abortRef.current) cancelRequest();
    const s = deps.getState();
    const save = migrateSave(rawSave);
    let found = null;
    if (save.isCustom && save.premise) {
      found = save.premise;
    } else {
      found = PREMISES.find((p) => p.id === save.premiseId) || save.premise || null;
    }
    if (!found) {
      deps.saves.setSaveBanner({ kind: "err", text: "This hour is no longer here." });
      return;
    }
    deps.codex.revokeAllPlates(s.entries);
    deps.tts.stopTTS();
    deps.tts.resetTTSCursor((save.entries || []).length);
    // Rehydrate idb-backed illustrations BEFORE dispatching: a trailing
    // async SET_ENTRIES here used to clobber a turn submitted right after
    // the load landed.
    const rawEntries: Entry[] = await Promise.all(
      (save.entries || []).map(async (raw): Promise<Entry> => {
        const e: Entry = { ...raw, fullyRevealed: true };
        const ill = e.illustration;
        if (!ill || typeof ill.url !== "string" || !ill.url.startsWith("idb:")) return e;
        const imgKey = ill.url.slice("idb:".length);
        const blob = await getImage(imgKey);
        if (!blob) return { ...e, illustration: { ...ill, status: "failed", url: undefined } };
        return { ...e, illustration: { ...ill, url: URL.createObjectURL(blob) } };
      }),
    );
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
    deps.codex.restoreCodex(save.codex);
    deps.reveal.resetReveal();
    deps.keepsake.resetKeepsake();
    deps.saves.setShowSaves(false);
    deps.saves.setSaveBanner({ kind: "ok", text: "The hour resumes." });
    await deps.ambience.ensureAmbienceEngine();
    if (deps.ambience.ambienceRef.current) {
      const bed = (found.realm === "wild" && found.seed)
        ? deriveAmbienceFromSeed(found.seed)
        : defaultAmbienceForRealm(found.realm);
      deps.ambience.ambienceRef.current.applyAmbience(bed);
    }
  }

  async function resumeAutosave(): Promise<void> {
    const rec = await deps.saves.readAutosave();
    if (!rec) {
      deps.saves.setSaveBanner({ kind: "err", text: "There is no unfinished hour to resume." });
      return;
    }
    await loadSave(rec);
  }

  return {
    beginAdventure: exclusive(beginAdventure, undefined),
    submit: exclusive(submit, true),
    continueNarration: exclusive(continueNarration, undefined),
    undoLastTurn,
    loadSave,
    resumeAutosave,
    cancelRequest,
    restart,
  };
}
