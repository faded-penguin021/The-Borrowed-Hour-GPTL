// @ts-check
import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from "react";
import { EMPTY_STATE } from "../data/constants.js";
import { DEFAULT_LANGUAGE } from "../data/languages.js";
import { PREMISES, NARRATION_LOADING_PHRASES, META_LOADING_PHRASES, OPENING_LOADING_PHRASES, pickPhrase } from "../data/premises.js";
import { GM_TOOL, GM_LOGIC_TOOL, buildSystem, buildNarratorSystem, buildMetaSystem } from "../llm/tools.js";
import { parseGMResponse, parseGMLogicResponse, isStateEmpty } from "../llm/parse.js";
import { formatStateForPrompt, stripHistoricalUser, stripHistoricalAssistant, serializeStatePublic } from "../llm/prompt.js";
import { formatError, BorrowedError } from "../llm/errors.js";
import { createLLMClient } from "../llm/client.js";
import { useCodex } from "../hooks/useCodex.js";
import { useSaves } from "../hooks/useSaves.js";
import { useReveal } from "../hooks/useReveal.js";
import { useKeepsake } from "../hooks/useKeepsake.js";
import { useLatest } from "../hooks/useLatest.js";
import { useSettingsContext } from "./SettingsContext.jsx";
import { useAmbienceContext } from "./AmbienceContext.jsx";
import { useTTSContext } from "./TTSContext.jsx";

const GameContext = createContext(/** @type {any} */ (null));
const GameRunContext = createContext(/** @type {any} */ (null));

/**
 * Access the low-frequency story state and actions (phase, premise, entries,
 * history, game state, endings, saves, codex). Note that `input` is
 * deliberately NOT here — it lives locally in the composer so keystrokes never
 * re-render the narration log or any other context consumer.
 * @returns {any}
 */
export function useGame() {
  return useContext(GameContext);
}

/**
 * Access the high-frequency / transient runtime state (loading, loading phrase,
 * error, session token tally). Kept apart from `useGame()` so transient runtime
 * churn doesn't have to re-render consumers that only care about story state.
 * @returns {any}
 */
export function useGameRun() {
  return useContext(GameRunContext);
}

/**
 * Holds the core game-loop state and orchestrates the multi-agent calls.
 * Settings, ambience, and TTS come from their own contexts; codex and saves are
 * owned here because only the loop drives them.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function GameProvider({ children }) {
  const { settings } = useSettingsContext();
  const ambience = useAmbienceContext();
  const tts = useTTSContext();

  const [phase, setPhase] = useState("title");
  const [premise, setPremise] = useState(/** @type {Premise | null} */ (null));
  const [entries, setEntries] = useState(/** @type {Entry[]} */ ([]));
  const [history, setHistory] = useState(/** @type {ChatMessage[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {any} */ (null));
  const [ended, setEnded] = useState(false);
  const [gameState, setGameState] = useState(EMPTY_STATE);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [metaMode, setMetaMode] = useState(false);
  const [metaMessages, setMetaMessages] = useState(/** @type {any[]} */ ([]));
  const [skipNonce, setSkipNonce] = useState(0);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [recovery, setRecovery] = useState(/** @type {any} */ (null));
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 });
  const sessionTokensRef = useRef({ input: 0, output: 0 });

  const abortRef = useRef(/** @type {any} */ (null));
  // Mirror settings so the long-lived API client closure always reads the
  // freshest engine config without re-creating the client.
  const settingsRef = useLatest(settings);

  // ── API layer (shared module; codex reuses callAPI) ───────────────
  const clientRef = useRef(/** @type {ReturnType<typeof createLLMClient> | null} */ (null));
  if (!clientRef.current) {
    clientRef.current = createLLMClient({
      getDefaultEngine: () => settingsRef.current.engineNarrator,
      getProxyUrl: () => settingsRef.current.proxyUrl,
      onUsage: (inp, out) => {
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
  const codex = useCodex({ callAPI, settings, premise, language, setEntries });
  const saves = useSaves();
  const reveal = useReveal({
    streamAPI,
    getEngine: () => settingsRef.current.engineNarrator,
  });
  const keepsake = useKeepsake({ setExportFallbackText: (text) => saves.setExportFallbackText(text) });

  const { ensureAmbienceEngine, ambienceRef } = ambience;

  // ── Auto-speak newly revealed narration ──────────────────────────
  useEffect(() => {
    tts.autoSpeak(entries);
  }, [entries, tts.ttsEnabled, tts.ttsMuted, tts.ttsProviderId]);

  // ── Late-enable ambience during play ─────────────────────────────
  useEffect(() => {
    const eng = ambienceRef.current;
    if (eng) return;
    if (ambience.ambienceLevel !== "off" && phase === "playing" && premise) {
      (async () => {
        const built = await ensureAmbienceEngine();
        if (built) {
          const { defaultAmbienceForRealm, deriveAmbienceFromSeed } = await import("../ambience/tables.js");
          const bed = (premise.realm === "wild" && premise.seed)
            ? deriveAmbienceFromSeed(premise.seed)
            : defaultAmbienceForRealm(premise.realm);
          built.applyAmbience(bed);
        }
      })();
    }
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
  }, [saves.saveBanner]);

  // ── Game actions ─────────────────────────────────────────────────
  const skipReveal = () => setSkipNonce((n) => n + 1);

  const finalizeNarration = (narration, gmParsed, baseEntries, baseHistory, fullyRevealed) => {
    const assistantPayload = JSON.stringify({ gm_scratchpad: "", narration, state: gmParsed.state, ending: gmParsed.ending });
    setHistory([...baseHistory, { role: "assistant", content: assistantPayload }]);
    setEntries((prev) => {
      const existing = prev[baseEntries.length];
      const entry = { type: "narration", text: narration, fullyRevealed };
      if (existing && existing.illustration) entry.illustration = existing.illustration;
      return [...baseEntries, entry];
    });
    if (gmParsed.state && !(isStateEmpty(gmParsed.state) && !isStateEmpty(gameState))) {
      setGameState(gmParsed.state);
    }
    if (gmParsed.ending) setEnded(true);
  };

  /** @param {Premise} chosen @returns {Promise<void>} */
  const beginAdventure = async (chosen) => {
    codex.revokeAllPlates(entries);
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    setPremise(chosen);
    setPhase("playing");
    setGameState(EMPTY_STATE);
    codex.resetCodex();
    setLoadingPhrase(pickPhrase(OPENING_LOADING_PHRASES));
    setLoading(true);
    setError(null);
    setRecovery(null);
    await ensureAmbienceEngine();
    const controller = new AbortController;
    const rollback = () => {
      setPhase("title");
      setPremise(null);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const sys = buildSystem(chosen, language);
      /** @type {ChatMessage[]} */
      const msgs = [{ role: "user", content: "Begin." }];
      const bootstrapPromise = codex.runArtDirectorBootstrap(chosen, controller.signal);
      const firstRaw = await callAPI(sys, msgs, true, settings.engineOpening, 4500, 0.7, controller.signal);
      bootstrapPromise.catch(() => {});
      if (controller.signal.aborted) return;
      let openingRaw = firstRaw;
      let parsed = parseGMResponse(openingRaw);
      if (parsed.malformed) {
        const priorAssistant = (openingRaw && openingRaw.trim()) ? openingRaw : "(empty response)";
        /** @type {ChatMessage[]} */
        const correctiveMsgs = [
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
      setHistory([...msgs, { role: "assistant", content: openingRaw }]);
      setEntries([{ type: "narration", text: parsed.narration, fullyRevealed: false }]);
      if (parsed.state) setGameState(parsed.state);
      if (parsed.ending) setEnded(true);
      if (ambienceRef.current) {
        const { defaultAmbienceForRealm, deriveAmbienceFromSeed } = await import("../ambience/tables.js");
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
      if (!cancelled) setError(formatError(e));
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
    setError(null);
    setRecovery(null);
    setLoadingPhrase(pickPhrase(NARRATION_LOADING_PHRASES));
    setLoading(true);
    const narrationIndex = rec.baseEntries.length;
    let acc = rec.partial;
    const controller = new AbortController;
    const rollback = () => {
      finalizeNarration(rec.partial, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
      setRecovery(rec);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    const continuePrompt = `${rec.narratorPrompt}

[Partial narration already shown to the player]
${rec.partial}

The narration above was interrupted and cut off before it finished. Continue it seamlessly from exactly where it stops — do not repeat or restate any of it, do not open a new scene. Write only the continuation, carrying the same passage to a natural close.`;
    const onDelta = (chunk) => {
      acc += chunk;
      setEntries((prev) => {
        if (!prev[narrationIndex] || prev[narrationIndex].type !== "narration") return prev;
        const next = prev.slice();
        next[narrationIndex] = { ...next[narrationIndex], text: acc };
        return next;
      });
    };
    setEntries([...rec.baseEntries, { type: "narration", text: rec.partial, streaming: true }]);
    try {
      await streamAPI(rec.narratorSys, [{ role: "user", content: continuePrompt }], settings.engineNarrator, 700, 0.8, controller.signal, onDelta);
      if (controller.signal.aborted) return;
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return;
      setError(formatError(e));
      finalizeNarration(acc, rec.gmParsed, rec.baseEntries, rec.baseHistory, true);
      setRecovery({ ...rec, partial: acc });
    } finally {
      if (abortRef.current?.controller === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  /**
   * Process one turn. The composer owns the input text and passes it in.
   * @param {string} text
   * @returns {Promise<boolean>} false when the input should be restored
   */
  const submit = async (text) => {
    text = (text || "").trim();
    if (!text || loading) return true;
    if (!metaMode && ended) return true;
    skipReveal();
    setRecovery(null);
    if (!metaMode) await ensureAmbienceEngine();
    if (metaMode) {
      const previousMeta = metaMessages;
      const newMeta = [
        ...metaMessages,
        { role: "user", text, fullyRevealed: true }
      ];
      setMetaMessages(newMeta);
      setLoadingPhrase(pickPhrase(META_LOADING_PHRASES));
      setLoading(true);
      setError(null);
      const controller2 = new AbortController;
      const rollback2 = () => {
        setMetaMessages(previousMeta);
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
        const metaApiMessages = [
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
        setMetaMessages([
          ...newMeta,
          { role: "assistant", text: reply, fullyRevealed: false }
        ]);
        return true;
      } catch (e) {
        if (controller2.signal.aborted) return false;
        const cancelled = e instanceof BorrowedError && e.detail === "Request cancelled by the player.";
        if (!cancelled) setError(formatError(e));
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
    /** @type {Entry[]} */
    const newEntries = [...entries, { type: "action", text, fullyRevealed: true }];
    setEntries(newEntries);
    if (tts.ttsRef.current) tts.ttsRef.current.stop();
    const { publicBlock, privateBlock } = formatStateForPrompt(gameState);
    const parts = [];
    if (publicBlock) parts.push(publicBlock);
    parts.push(`[Player action]\n${text}`);
    if (privateBlock) parts.push(privateBlock);
    const playerMessage = parts.join("\n\n");
    /** @type {ChatMessage[]} */
    const newHistory = [...history, { role: "user", content: playerMessage }];
    const tailStart = newHistory.length - 1;
    let apiHistory = newHistory.map((msg, i) => {
      if (i >= tailStart) return msg;
      return msg.role === "user" ? { ...msg, content: stripHistoricalUser(msg.content) } : { ...msg, content: stripHistoricalAssistant(msg.content) };
    });
    const TRIM_THRESHOLD = 60;
    const KEEP_RECENT = 44;
    const CHAR_CAP = settings.engineGM?.provider === "groq" ? 60000 : 80000;
    const charsOf = (msgs) => msgs.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
    if (apiHistory.length > TRIM_THRESHOLD) {
      const head = apiHistory.slice(0, 2);
      const tail = apiHistory.slice(-KEEP_RECENT);
      apiHistory = [...head, ...tail];
    }
    if (charsOf(apiHistory) > CHAR_CAP) {
      const head = apiHistory.slice(0, 2);
      let tail = apiHistory.slice(2);
      while (tail.length > 4 && charsOf([...head, ...tail]) > CHAR_CAP) {
        tail = tail.slice(2);
      }
      apiHistory = [...head, ...tail];
    }
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[borrowed] apiHistory", {
        msgs: apiHistory.length,
        chars: charsOf(apiHistory),
        estTokens: Math.round(charsOf(apiHistory) / 4)
      });
    }
    setHistory(newHistory);
    setLoadingPhrase(pickPhrase(NARRATION_LOADING_PHRASES));
    setLoading(true);
    setError(null);
    const controller = new AbortController;
    const rollback = () => {
      setEntries(previousEntries);
      setHistory(previousHistory);
    };
    abortRef.current = { controller, rollback, startedAt: Date.now() };
    try {
      const gmSys = buildSystem(premise, language, { split: true });
      const firstGmReply = await callAPI(gmSys, apiHistory, true, settings.engineGM, 2600, 0.35, controller.signal, GM_LOGIC_TOOL);
      if (controller.signal.aborted) return false;
      let gmReply = firstGmReply;
      let gmParsed = parseGMLogicResponse(gmReply);
      if (gmParsed.malformed) {
        const priorAssistant = (gmReply && gmReply.trim()) ? gmReply : "(empty response)";
        /** @type {ChatMessage[]} */
        const correctiveHistory = [
          ...apiHistory,
          { role: "assistant", content: priorAssistant },
          { role: "user", content: `Your previous response could not be parsed. Reason: ${gmParsed.diagnostic || "missing required fields"}.

Call the tool \`gm_decide\` again. Required top-level fields: gm_scratchpad (string, keep it brief — under 120 words), narrator_brief (string, non-empty, the compressed brief for the narrator), state (object with: scene, time, inventory, npcs, clues, summary, hidden_state). Optional: ending. Output ONLY the tool call / JSON object — no prose, no markdown fences.` }
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
        setEntries((prev) => {
          const existing = prev[narrationIndex];
          const entry = /** @type {NarrationEntry} */ ({ type: "narration", text: "", streaming: true });
          if (existing && existing.illustration) entry.illustration = existing.illustration;
          return [...newEntries, entry];
        });
        const onDelta = (chunk) => {
          acc += chunk;
          setEntries((prev) => {
            if (!prev[narrationIndex] || prev[narrationIndex].type !== "narration") return prev;
            const next = prev.slice();
            next[narrationIndex] = { ...next[narrationIndex], text: acc };
            return next;
          });
        };
        let narration;
        try {
          narration = await streamAPI(narratorSys, [{ role: "user", content: narratorPrompt }], settings.engineNarrator, 1200, 0.8, controller.signal, onDelta);
        } catch (e) {
          if (controller.signal.aborted) return false;
          if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return false;
          if (e && typeof e.partial === "string" && e.partial) {
            finalizeNarration(e.partial, gmParsed, newEntries, newHistory, true);
            setError(formatError(e));
            setRecovery({
              narratorSys, narratorPrompt, gmParsed,
              baseEntries: newEntries, baseHistory: newHistory,
              partial: e.partial
            });
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
      if (!cancelled) setError(formatError(e));
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
    setError(null);
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
    setHistory(newHistory);
    setEntries(newEntries);
    setGameState(newState);
    setEnded(false);
    setError(null);
    setRecovery(null);
    saves.setSaveBanner({ kind: "ok", text: "The last turn is unmade." });
  };

  const enterMetaMode = () => {
    setMetaMode(true);
    setMetaMessages([]);
  };

  const exitMetaMode = () => {
    setMetaMode(false);
    setMetaMessages([]);
  };

  const restart = () => {
    codex.revokeAllPlates(entries);
    sessionTokensRef.current = { input: 0, output: 0 };
    setSessionTokens({ input: 0, output: 0 });
    setPhase("title");
    setPremise(null);
    setEntries([]);
    setHistory([]);
    setError(null);
    setRecovery(null);
    setEnded(false);
    setGameState(EMPTY_STATE);
    setMetaMode(false);
    setMetaMessages([]);
    reveal.resetReveal();
    keepsake.resetKeepsake();
    if (ambienceRef.current) ambienceRef.current.applyAmbience(null);
    tts.stopTTS();
    tts.resetTTSCursor(0);
    codex.resetCodex();
  };

  const loadSave = async (save) => {
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
    setPremise(found);
    setEntries((save.entries || []).map((e) => ({ ...e, fullyRevealed: true })));
    setHistory(save.history || []);
    setError(null);
    setRecovery(null);
    setEnded(!!save.ended);
    setGameState(save.gameState || EMPTY_STATE);
    setLanguage(save.language || DEFAULT_LANGUAGE);
    setMetaMessages((save.metaMessages || []).map((m) => ({ ...m, fullyRevealed: true })));
    setMetaMode(!!save.metaMode);
    codex.restoreCodex(save.codex);
    reveal.resetReveal();
    keepsake.resetKeepsake();
    setPhase("playing");
    saves.setShowSaves(false);
    saves.setSaveBanner({ kind: "ok", text: "The hour resumes." });
    await ensureAmbienceEngine();
    if (ambienceRef.current) {
      const { defaultAmbienceForRealm, deriveAmbienceFromSeed } = await import("../ambience/tables.js");
      const bed = (found.realm === "wild" && found.seed)
        ? deriveAmbienceFromSeed(found.seed)
        : defaultAmbienceForRealm(found.realm);
      ambienceRef.current.applyAmbience(bed);
    }
    tts.stopTTS();
    tts.resetTTSCursor((save.entries || []).length);
  };

  const saveCurrent = () => saves.saveCurrent({
    premise, entries, ended, gameState, history, metaMessages, metaMode, language,
    codex: { styleBible: codex.styleBible, visualLedger: codex.visualLedger, plateCount: codex.plateCount }
  });

  const exportChronicle = (includeMeta = false) =>
    saves.exportChronicle({ premise, entries, ended, metaMessages }, includeMeta);

  const startReveal = () => reveal.triggerReveal(premise, entries, gameState, language);

  const startKeepsake = () => keepsake.generateKeepsake({
    premise, entries, revealText: reveal.revealText, metaMessages, ended
  });

  const keepsakeFilename = premise
    ? `the-borrowed-hour-${premise.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}.html`
    : "the-borrowed-hour.html";

  const markEntryRevealed = (index) => {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, fullyRevealed: true } : e));
  };

  const markMetaRevealed = (index) => {
    setMetaMessages((prev) => prev.map((m, i) => i === index ? { ...m, fullyRevealed: true } : m));
  };

  // High-frequency / transient runtime state. Memoized so run-only consumers
  // (useGameRun) re-render on runtime churn without dragging the whole story
  // value along, and vice versa.
  const runValue = useMemo(
    () => ({ loading, loadingPhrase, error, sessionTokens }),
    [loading, loadingPhrase, error, sessionTokens]
  );

  // Low-frequency story state + actions. Intentionally NOT memoized: the action
  // closures read live state each render, so rebuilding the object every render
  // avoids stale-closure hazards. `canUndo` is derived from `loading` here, which
  // is safe for the same reason (the object is rebuilt whenever `loading` flips).
  const value = {
    // state
    phase, premise, entries, history, gameState, language,
    ended, metaMode, metaMessages,
    skipNonce, recovery, canUndo,
    // saves surface
    saveBanner: saves.saveBanner, setSaveBanner: saves.setSaveBanner,
    showSaves: saves.showSaves, setShowSaves: saves.setShowSaves,
    saveList: saves.saveList, saveListLoading: saves.saveListLoading,
    savesTotalBytes: saves.savesTotalBytes,
    exportFallbackText: saves.exportFallbackText, setExportFallbackText: saves.setExportFallbackText,
    openSavesModal: saves.openSavesModal, deleteSave: saves.deleteSave,
    // reveal
    revealText: reveal.revealText,
    revealLoading: reveal.revealLoading,
    revealError: reveal.revealError,
    // keepsake
    keepsakeBlob: keepsake.keepsakeBlob,
    keepsakeLoading: keepsake.keepsakeLoading,
    keepsakeError: keepsake.keepsakeError,
    keepsakeFilename,
    // actions
    setLanguage,
    beginAdventure, submit, continueNarration,
    undoLastTurn, restart, loadSave,
    enterMetaMode, exitMetaMode,
    skipReveal, cancelRequest,
    saveCurrent, exportChronicle,
    startReveal, cancelReveal: reveal.cancelReveal,
    startKeepsake, downloadKeepsake: keepsake.downloadKeepsake,
    markEntryRevealed, markMetaRevealed,
  };

  return (
    <GameContext.Provider value={value}>
      <GameRunContext.Provider value={runValue}>{children}</GameRunContext.Provider>
    </GameContext.Provider>
  );
}
