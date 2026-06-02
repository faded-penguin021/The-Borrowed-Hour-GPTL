import { useState, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AppSettings, ChatMessage, CodexProviderConfig, CodexSnapshot, EngineConfig,
  Entry, GameState, Illustration, ImageProviderId, Premise, StyleBible,
  ThrownError, VisualLedgerEntry
} from "../types";
import type { CallAPI } from "../llm/client";
import {
  ART_DIRECTOR_BOOTSTRAP_TOOL, ART_DIRECTOR_TURN_TOOL,
  buildBootstrapSystem, buildTurnSystem,
  parseBootstrapResponse, parseTurnResponse,
  composeImagePrompt, mergeLedger, cleanPlateCaption
} from "../llm/artDirector";
import { generateImage } from "../llm/imaging";

/**
 * Runtime-tolerant view of the codex settings block. Fields are all optional
 * because callers fall back to `{}` when `settings.codex` is absent, and `mode`
 * is widened to `string` to accommodate legacy comparisons (e.g. "always").
 */
interface CodexConfig {
  mode?: string;
  artDirectorEngine?: EngineConfig;
  maxPerSession?: number;
  provider?: ImageProviderId;
  providerConfig?: CodexProviderConfig;
  timeoutMs?: number;
}

interface CodexDeps {
  callAPI: CallAPI;
  settings: AppSettings;
  premise: Premise | null;
  language: string;
  setEntries: Dispatch<SetStateAction<Entry[]>>;
}

/**
 * The slice of a parsed GM/logic turn the Art Director reads. Kept minimal so
 * both a full `GMLogicParseResult` and the opener's `{ state, narrator_brief }`
 * stand-in satisfy it.
 */
interface ArtDirectorTurnInput {
  state?: GameState | null;
  narrator_brief?: string;
}

interface RunArtDirectorTurnArgs {
  entryIndexProvider: () => number | null;
  gmParsed: ArtDirectorTurnInput;
  signal?: AbortSignal;
  opener?: boolean;
}

export function useCodex({ callAPI, settings, premise, language, setEntries }: CodexDeps) {
  const [styleBible, setStyleBible] = useState<StyleBible | null>(null);
  const [visualLedger, setVisualLedger] = useState<VisualLedgerEntry[]>([]);
  const [plateCount, setPlateCount] = useState(0);
  const styleBibleRef = useRef<StyleBible | null>(null);
  const visualLedgerRef = useRef<VisualLedgerEntry[]>([]);
  const plateCountRef = useRef(0);
  const turnIdRef = useRef(0);
  const inflightRef = useRef(0);

  useEffect(() => { styleBibleRef.current = styleBible; }, [styleBible]);
  useEffect(() => { visualLedgerRef.current = visualLedger; }, [visualLedger]);
  useEffect(() => { plateCountRef.current = plateCount; }, [plateCount]);

  const revokeBlobUrl = (url?: string) => {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  };

  const revokeAllPlates = (entriesArray: Entry[]) => {
    if (!Array.isArray(entriesArray)) return;
    for (const e of entriesArray) {
      if (e?.illustration?.url) revokeBlobUrl(e.illustration.url);
    }
  };

  const setEntryIllustration = (index: number, patch: Partial<Illustration>) => {
    setEntries((prev) => {
      const e = prev[index];
      if (!e) return prev;
      if (patch.url && e.illustration?.url && e.illustration.url !== patch.url) {
        revokeBlobUrl(e.illustration.url);
      }
      const next = prev.slice();
      next[index] = { ...e, illustration: { ...(e.illustration || {}), ...patch } as Illustration };
      return next;
    });
  };

  const resetCodex = () => {
    setStyleBible(null); styleBibleRef.current = null;
    setVisualLedger([]); visualLedgerRef.current = [];
    setPlateCount(0); plateCountRef.current = 0;
    turnIdRef.current = 0;
  };

  const restoreCodex = (savedCodex: Partial<CodexSnapshot> | null | undefined) => {
    const c: Partial<CodexSnapshot> = savedCodex || {};
    setStyleBible(c.styleBible || null);
    styleBibleRef.current = c.styleBible || null;
    setVisualLedger(c.visualLedger || []);
    visualLedgerRef.current = c.visualLedger || [];
    setPlateCount(c.plateCount || 0);
    plateCountRef.current = c.plateCount || 0;
  };

  const runArtDirectorBootstrap = async (chosen: Premise, signal: AbortSignal) => {
    const codex: CodexConfig = settings.codex || {};
    if (codex.mode === "off") return;
    const engine = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };
    try {
      const sys = buildBootstrapSystem(chosen, language);
      const msgs: ChatMessage[] = [{ role: "user", content: "Seed the codex for this chronicle." }];
      const raw = await callAPI(sys, msgs, true, engine, 1400, 0.4, signal, ART_DIRECTOR_BOOTSTRAP_TOOL);
      if (signal?.aborted) return;
      const parsed = parseBootstrapResponse(raw);
      if (parsed.malformed) return;
      setStyleBible(parsed.style_bible || null);
      setVisualLedger(parsed.visual_ledger || []);
    } catch (e) {
      const caught = e as ThrownError;
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Art Director bootstrap failed:", caught?.detail || caught?.message || e);
    }
  };

  const MAX_INFLIGHT = 2;

  const runArtDirectorTurn = async ({ entryIndexProvider, gmParsed, signal, opener = false }: RunArtDirectorTurnArgs) => {
    const codex: CodexConfig = settings.codex || {};
    if (codex.mode === "off") return;
    const cap = codex.maxPerSession ?? 12;
    if (plateCountRef.current >= cap && codex.mode !== "always") return;
    const sb = styleBibleRef.current;
    if (!sb) return;
    if (!premise) return;

    const myTurn = ++turnIdRef.current;
    const stale = () => signal?.aborted || myTurn !== turnIdRef.current;

    const engine = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };
    let ad: ReturnType<typeof parseTurnResponse>;
    try {
      const sys = buildTurnSystem(premise, sb, visualLedgerRef.current, language);
      const userPrompt = `[Scene]\n${gmParsed.state?.scene || ""}\n\n[Narrator brief]\n${gmParsed.narrator_brief || ""}\n\n[Named NPCs present this turn]\n${(gmParsed.state?.npcs || []).map((n) => `- ${n.name}: ${n.note}`).join("\n") || "(none)"}\n\nDecide if this turn warrants a plate. Be ruthless; the default is no.`;
      const raw = await callAPI(sys, [{ role: "user", content: userPrompt }], true, engine, 900, 0.4, signal, ART_DIRECTOR_TURN_TOOL);
      if (stale()) return;
      const parsed = parseTurnResponse(raw);
      if (parsed.malformed) return;
      if (parsed.ledger_updates?.length) {
        const merged = mergeLedger(visualLedgerRef.current, parsed.ledger_updates);
        visualLedgerRef.current = merged;
        setVisualLedger(merged);
      }
      ad = parsed;
    } catch (e) {
      const caught = e as ThrownError;
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Art Director turn failed:", caught?.detail || caught?.message || e);
      return;
    }

    if (stale()) return;

    const reason = (ad.milestone_reason || "").trim();
    const NEG = /\b(no|not|none|nothing|minor|routine|absent|n\/a|skip)\b/i;
    let sceneClause = (ad.scene_clause || "").trim();
    let wants: boolean | undefined;
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

    if (inflightRef.current >= MAX_INFLIGHT) return;

    const idx = entryIndexProvider();
    if (idx == null || idx < 0) return;
    setEntryIllustration(idx, { status: "pending", caption: cleanPlateCaption(ad.caption || ""), milestoneReason: ad.milestone_reason || "" });
    plateCountRef.current = plateCountRef.current + 1;
    setPlateCount(plateCountRef.current);

    const { prompt, negatives } = composeImagePrompt({
      styleBible: sb,
      visualLedger: visualLedgerRef.current,
      subjectIds: ad.subject_ids,
      sceneClause,
      extraNegatives: ad.extra_negatives
    });

    inflightRef.current++;
    try {
      if (stale()) return;
      const providerId = codex.provider || "pollinations";
      const providerCfg = (codex.providerConfig && codex.providerConfig[providerId]) || {};
      const img = await generateImage({
        providerId, providerConfig: providerCfg, prompt, negatives,
        signal, timeoutMs: codex.timeoutMs || 20000
      });
      if (stale()) return;
      setEntryIllustration(idx, { status: "ready", url: img.url, prompt, provider: img.provider });
    } catch (e) {
      if (stale()) return;
      const caught = e as ThrownError;
      if (typeof console !== "undefined" && console.warn) console.warn("[borrowed] Image generation failed:", caught?.detail || caught?.message || e);
      setEntryIllustration(idx, { status: "failed" });
    } finally {
      inflightRef.current--;
    }
  };

  return {
    styleBible, visualLedger, plateCount,
    setEntryIllustration,
    revokeAllPlates,
    resetCodex,
    restoreCodex,
    runArtDirectorBootstrap,
    runArtDirectorTurn,
  };
}
