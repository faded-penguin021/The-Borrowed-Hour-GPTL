import type { ChatMessage, Entry, MetaMessage, NarrationEntry, Premise, SaveRecord, ThrownError, AppSettings, SaveBanner } from "../types";
import type { CallAPI, StreamAPI } from "../llm/client";
import type { StoryAction, StoryState, RecoveryGMParsed, StreamingStore } from "./storyReducer";
import type { CodexSnapshot } from "../types";
import { EMPTY_STATE } from "../data/constants";
import { PREMISES, NARRATION_LOADING_PHRASES, META_LOADING_PHRASES, OPENING_LOADING_PHRASES, pickPhrase } from "../data/premises";
import { GM_LOGIC_TOOL, buildSystem, buildNarratorSystem, buildMetaSystem } from "../llm/tools";
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
    codex, saves, progress, tts, ambience, reveal, keepsake,
  } = deps;

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
      progress.recordEnding(s.premise?.id, gmParsed.ending);
    }
  }

  async function beginAdventure(chosen: Premise): Promise<void> {
    const s = deps.getState();
    const settings = deps.getSettings();
    codex.revokeAllPlates(s.entries);
    deps.resetSessionTokens();
    dispatch({ type: "START_GAME", premise: chosen });
    saves.clearAutosave();
    codex.resetCodex();
    setLoadingPhrase(pickPhrase(OPENING_LOADING_PHRASES));
    setLoading(true);
    await ambience.ensureAmbienceEngine();
    const controller = new AbortController;
    const rollback = () => {
      dispatch({ type: "SET_PHASE", phase: "title" });
      dispatch({ type: "SET_PREMISE", premise: null });
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const sys = buildSystem(chosen, s.language);
      dlog("prompt:opening:system", sys.length, "chars");
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
      if (ambience.ambienceRef.current) {
        const bed = (chosen.realm === "wild" && chosen.seed)
          ? deriveAmbienceFromSeed(chosen.seed)
          : defaultAmbienceForRealm(chosen.realm);
        ambience.ambienceRef.current.applyAmbience(bed);
        if (parsed.ambience !== undefined)
          ambience.ambienceRef.current.applyAmbience(parsed.ambience);
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
    if (!s.metaMode) await ambience.ensureAmbienceEngine();

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
        const sys = buildMetaSystem(s.premise, s.language);
        dlog("prompt:meta:system", sys.length, "chars");
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
    if (tts.ttsRef.current) tts.ttsRef.current.stop();
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
      const gmSys = buildSystem(s.premise, s.language, { split: true });
      dlog("prompt:gm:system", gmSys.length, "chars");
      dlog("prompt:gm:history", apiHistory.length, "msgs");
      const firstGmReply = await callAPI(gmSys, apiHistory, true, settings.engineGM, 2600, 0.35, controller.signal, GM_LOGIC_TOOL, cacheBreakpoint, s.premise?.id);
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
      if (ambience.ambienceRef.current && gmParsed.ambience !== undefined)
        ambience.ambienceRef.current.applyAmbience(gmParsed.ambience);
      const artDirectorPromise = codex.runArtDirectorTurn({
        entryIndexProvider: () => newEntries.length,
        gmParsed,
        signal: controller.signal
      });
      artDirectorPromise.catch(() => {});
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
    const canUndo = !loading && !s.metaMode && s.history.length >= 4 && s.entries.length >= 3;
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
    saves.setSaveBanner({ kind: "ok", text: "The last turn is unmade." });
  }

  function restart() {
    const s = deps.getState();
    codex.revokeAllPlates(s.entries);
    deps.resetSessionTokens();
    dispatch({ type: "RESET" });
    reveal.resetReveal();
    keepsake.resetKeepsake();
    if (ambience.ambienceRef.current) ambience.ambienceRef.current.applyAmbience(null);
    tts.stopTTS();
    tts.resetTTSCursor(0);
    codex.resetCodex();
  }

  async function loadSave(rawSave: SaveRecord): Promise<void> {
    const s = deps.getState();
    const save = migrateSave(rawSave);
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
    codex.revokeAllPlates(s.entries);
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
    await ambience.ensureAmbienceEngine();
    if (ambience.ambienceRef.current) {
      const bed = (found.realm === "wild" && found.seed)
        ? deriveAmbienceFromSeed(found.seed)
        : defaultAmbienceForRealm(found.realm);
      ambience.ambienceRef.current.applyAmbience(bed);
    }
  }

  async function resumeAutosave(): Promise<void> {
    const rec = await saves.readAutosave();
    if (!rec) {
      saves.setSaveBanner({ kind: "err", text: "There is no unfinished hour to resume." });
      return;
    }
    await loadSave(rec);
  }

  return {
    beginAdventure,
    submit,
    continueNarration,
    undoLastTurn,
    loadSave,
    resumeAutosave,
    cancelRequest,
    restart,
  };
}
