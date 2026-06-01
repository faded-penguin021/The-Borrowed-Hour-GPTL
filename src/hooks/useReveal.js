// @ts-check
/**
 * @import { ChatMessage, EngineConfig, Entry, GameState, Premise } from "../types"
 */
import { useState, useRef } from "react";
import { buildRevealSystem } from "../prompts/reveal.js";
import { BorrowedError, formatError } from "../llm/errors.js";

/**
 * Manages the post-ending hidden-state reveal stream. Encapsulates
 * `revealText`, `revealLoading`, the `AbortController`, and the `streamAPI`
 * call so `GameContext` stays a pure coordinator.
 *
 * @param {{
 *   streamAPI: (
 *     sys: string,
 *     msgs: ChatMessage[],
 *     engine: EngineConfig,
 *     maxTokens: number,
 *     temperature: number,
 *     signal: AbortSignal,
 *     onDelta: (delta: string) => void
 *   ) => Promise<string>,
 *   getEngine: () => EngineConfig,
 * }} deps
 */
export function useReveal({ streamAPI, getEngine }) {
  const [revealText, setRevealText] = useState("");
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState(/** @type {any} */ (null));
  const abortRef = useRef(/** @type {AbortController | null} */ (null));

  /**
   * @param {Premise} premise
   * @param {Entry[]} entries
   * @param {GameState} gameState
   * @param {string} language
   */
  const triggerReveal = async (premise, entries, gameState, language) => {
    if (abortRef.current) return;
    setRevealLoading(true);
    setRevealText("");
    setRevealError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const sys = buildRevealSystem(premise, language, gameState);
    const lines = [];
    for (const e of entries) {
      if (e.type === "narration") lines.push(`[SCENE]\n${e.text}`);
      else if (e.text) lines.push(`[PLAYER]\n${e.text}`);
    }

    try {
      await streamAPI(
        sys,
        [{ role: "user", content: lines.join("\n\n") }],
        getEngine(),
        800,
        0.85,
        controller.signal,
        (delta) => setRevealText((prev) => prev + delta)
      );
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof BorrowedError && e.detail === "Request cancelled by the player.") return;
      setRevealError(formatError(e));
    } finally {
      if (abortRef.current === controller) {
        setRevealLoading(false);
        abortRef.current = null;
      }
    }
  };

  const cancelReveal = () => {
    const ctrl = abortRef.current;
    if (!ctrl) return;
    abortRef.current = null;
    setRevealLoading(false);
    try { ctrl.abort(); } catch {}
  };

  const resetReveal = () => {
    cancelReveal();
    setRevealText("");
    setRevealError(null);
  };

  return { revealText, revealLoading, revealError, triggerReveal, cancelReveal, resetReveal };
}
