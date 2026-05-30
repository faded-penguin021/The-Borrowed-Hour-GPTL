// @ts-check
import { useState, useRef, useEffect } from "react";
import {
  ART_DIRECTOR_BOOTSTRAP_TOOL, ART_DIRECTOR_TURN_TOOL,
  buildBootstrapSystem, buildTurnSystem,
  parseBootstrapResponse, parseTurnResponse,
  composeImagePrompt, mergeLedger, cleanPlateCaption
} from "../llm/artDirector.js";

/**
 * @param {{
 *   callAPI: Function,
 *   settings: AppSettings,
 *   premise: any,
 *   language: string,
 *   setEntries: Function,
 * }} deps
 */
export function useCodex({ callAPI, settings, premise, language, setEntries }) {
  const [styleBible, setStyleBible] = useState(null);
  const [visualLedger, setVisualLedger] = useState([]);
  const [plateCount, setPlateCount] = useState(0);
  const styleBibleRef = useRef(null);
  const visualLedgerRef = useRef([]);
  const plateCountRef = useRef(0);

  useEffect(() => { styleBibleRef.current = styleBible; }, [styleBible]);
  useEffect(() => { visualLedgerRef.current = visualLedger; }, [visualLedger]);
  useEffect(() => { plateCountRef.current = plateCount; }, [plateCount]);

  const setEntryIllustration = (index, patch) => {
    setEntries((prev) => {
      const e = prev[index];
      if (!e) return prev;
      const next = prev.slice();
      next[index] = { ...e, illustration: { ...(e.illustration || {}), ...patch } };
      return next;
    });
  };

  const resetCodex = () => {
    setStyleBible(null); styleBibleRef.current = null;
    setVisualLedger([]); visualLedgerRef.current = [];
    setPlateCount(0); plateCountRef.current = 0;
  };

  const restoreCodex = (savedCodex) => {
    const c = savedCodex || {};
    setStyleBible(c.styleBible || null);
    styleBibleRef.current = c.styleBible || null;
    setVisualLedger(c.visualLedger || []);
    visualLedgerRef.current = c.visualLedger || [];
    setPlateCount(c.plateCount || 0);
    plateCountRef.current = c.plateCount || 0;
  };

  const runArtDirectorBootstrap = async (chosen, signal) => {
    const codex = settings.codex || {};
    if (codex.mode === "off") return;
    const engine = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };
    try {
      const sys = buildBootstrapSystem(chosen, language);
      const msgs = [{ role: "user", content: "Seed the codex for this chronicle." }];
      const raw = await callAPI(sys, msgs, true, engine, 1400, 0.4, signal, ART_DIRECTOR_BOOTSTRAP_TOOL);
      if (signal?.aborted) return;
      const parsed = parseBootstrapResponse(raw);
      if (parsed.malformed) return;
      setStyleBible(parsed.style_bible);
      setVisualLedger(parsed.visual_ledger || []);
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Art Director bootstrap failed:", e?.detail || e?.message || e);
    }
  };

  const runArtDirectorTurn = async ({ entryIndexProvider, gmParsed, signal, opener = false }) => {
    const codex = settings.codex || {};
    if (codex.mode === "off") return;
    const cap = codex.maxPerSession ?? 12;
    if (plateCountRef.current >= cap && codex.mode !== "always") return;
    const sb = styleBibleRef.current;
    if (!sb) return;

    const engine = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };
    let ad;
    try {
      const sys = buildTurnSystem(premise, sb, visualLedgerRef.current, language);
      const userPrompt = `[Scene]\n${gmParsed.state?.scene || ""}\n\n[Narrator brief]\n${gmParsed.narrator_brief || ""}\n\n[Named NPCs present this turn]\n${(gmParsed.state?.npcs || []).map((n) => `- ${n.name}: ${n.note}`).join("\n") || "(none)"}\n\nDecide if this turn warrants a plate. Be ruthless; the default is no.`;
      const raw = await callAPI(sys, [{ role: "user", content: userPrompt }], true, engine, 900, 0.4, signal, ART_DIRECTOR_TURN_TOOL);
      if (signal?.aborted) return;
      const parsed = parseTurnResponse(raw);
      if (parsed.malformed) return;
      if (parsed.ledger_updates?.length) {
        const merged = mergeLedger(visualLedgerRef.current, parsed.ledger_updates);
        visualLedgerRef.current = merged;
        setVisualLedger(merged);
      }
      ad = parsed;
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Art Director turn failed:", e?.detail || e?.message || e);
      return;
    }

    const reason = (ad.milestone_reason || "").trim();
    const NEG = /\b(no|not|none|nothing|minor|routine|absent|n\/a|skip)\b/i;
    let sceneClause = (ad.scene_clause || "").trim();
    let wants;
    if (opener || codex.mode === "always") {
      if (!sceneClause || sceneClause.length < 12) {
        sceneClause = (gmParsed.state?.scene || gmParsed.narrator_brief || "").trim();
      }
      wants = sceneClause.length >= 12;
    } else {
      const looksNegative = !reason || reason.length < 6 || NEG.test(reason);
      wants = ad.warrants_illustration && !looksNegative && sceneClause.length >= 12;
    }
    if (!wants) return;

    const idx = entryIndexProvider();
    if (idx == null || idx < 0) return;
    setEntryIllustration(idx, { status: "pending", caption: cleanPlateCaption(ad.caption), milestoneReason: ad.milestone_reason || "" });
    plateCountRef.current = plateCountRef.current + 1;
    setPlateCount(plateCountRef.current);

    const { prompt, negatives } = composeImagePrompt({
      styleBible: sb,
      visualLedger: visualLedgerRef.current,
      subjectIds: ad.subject_ids,
      sceneClause,
      extraNegatives: ad.extra_negatives
    });

    try {
      const providerId = codex.provider || "pollinations";
      const providerCfg = (codex.providerConfig && codex.providerConfig[providerId]) || {};
      const { generateImage: _generateImage } = await import("../llm/imaging.js");
      const img = await _generateImage({
        providerId, providerConfig: providerCfg, prompt, negatives,
        signal, timeoutMs: codex.timeoutMs || 20000
      });
      if (signal?.aborted) return;
      setEntryIllustration(idx, { status: "ready", url: img.url, prompt, provider: img.provider });
    } catch (e) {
      if (signal?.aborted) return;
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Image generation failed:", e?.detail || e?.message || e);
      setEntryIllustration(idx, { status: "failed" });
    }
  };

  return {
    styleBible, visualLedger, plateCount,
    setEntryIllustration,
    resetCodex,
    restoreCodex,
    runArtDirectorBootstrap,
    runArtDirectorTurn,
  };
}
