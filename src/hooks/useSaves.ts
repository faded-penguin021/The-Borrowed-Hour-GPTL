import { useState, useEffect } from "react";
import type { SyntheticEvent as ReactSyntheticEvent } from "react";
import type {
  ChatMessage, CodexSnapshot, Entry, GameState, MetaMessage, Premise,
  SaveBanner, SaveListEntry, SaveRecord, ThrownError
} from "../types";
import { SAVE_PREFIX, AUTOSAVE_KEY, SAVE_CAP, estimateSize, formatKB, formatTokens } from "../data/constants";
import { putImage, deleteImagesForSave, putDoc, getDoc } from "../storage/imageStore";
import { migrateSave, CURRENT_SAVE_VERSION } from "../saves/migrate";
import { compressSave, decompressSave } from "../saves/compression";
import { dlog } from "../debug/debugLog";

export interface SaveCurrentArgs {
  premise: Premise | null;
  entries: Entry[];
  ended: boolean;
  gameState: GameState | null;
  history: ChatMessage[];
  metaMessages: MetaMessage[];
  metaMode: boolean;
  language: string;
  codex: CodexSnapshot | null;
}

interface ExportChronicleArgs {
  premise: Premise | null;
  entries: Entry[];
  ended: boolean;
  metaMessages: MetaMessage[];
}

// The fixed id carried inside the autosave slot's payload. Manual saves use a
// timestamp id; the autosave is a single slot, so its id is constant.
const AUTOSAVE_ID = "autosave";

/**
 * Assemble the persisted record shared by manual saves and the autosave slot.
 * The two differ only in their `id` and how `entries` were prepared
 * (image-offloaded for a manual save, slimmed for the autosave), so everything
 * else is built here once. `turns` is counted from the live `entries` so it is
 * unaffected by either transform.
 */
function buildSavePayload(
  premise: Premise,
  args: SaveCurrentArgs,
  id: string,
  entries: Entry[]
): SaveRecord {
  return {
    id,
    premiseId: premise.id,
    premise,
    title: premise.title,
    realm: premise.realm,
    realmLabel: premise.realmLabel,
    isCustom: !!premise.isCustom,
    savedAt: Date.now(),
    turns: args.entries.filter((e) => e.type === "action").length,
    ended: args.ended,
    gameState: args.gameState,
    entries,
    history: args.history,
    metaMessages: args.metaMessages.map((m) => ({ ...m, fullyRevealed: true })),
    metaMode: args.metaMode,
    language: args.language,
    codex: args.codex,
    schemaVersion: CURRENT_SAVE_VERSION,
  };
}

// Prepare entries for the autosave slot. Unlike a manual save (which offloads
// each plate's bytes to IndexedDB), the slot is rewritten every turn, so we keep
// it cheap: references to bytes already persisted by a manual save (`idb:`
// markers) are retained, while live `blob:`/`data:` plates are dropped. Crash
// recovery is about the prose, state, and history — illustrations are a bonus.
function slimEntriesForAutosave(entries: Entry[]): Entry[] {
  return entries.map((e) => {
    const base: Entry = { ...e, fullyRevealed: true };
    const ill = e.illustration;
    if (ill && typeof ill.url === "string" && ill.url.startsWith("idb:")) return base;
    return { ...base, illustration: undefined };
  });
}

export function useSaves() {
  const [saveList, setSaveList] = useState<SaveListEntry[]>([]);
  const [saveListLoading, setSaveListLoading] = useState(false);
  const [saveBanner, setSaveBanner] = useState<SaveBanner | null>(null);
  const [savesTotalBytes, setSavesTotalBytes] = useState(0);
  const [showSaves, setShowSaves] = useState(false);
  const [exportFallbackText, setExportFallbackText] = useState<string | null>(null);
  // Whether an autosave slot is present on disk. Drives the title-screen resume
  // affordance. Kept as a boolean (not the record) so the per-turn slot rewrite
  // doesn't churn React state — the latest record is read fresh on resume.
  const [hasAutosave, setHasAutosave] = useState(false);

  // Probe for an existing autosave once on mount so the title screen can offer
  // to resume it after a reload or crash.
  useEffect(() => {
    let alive = true;
    readAutosave().then((rec) => { if (alive) setHasAutosave(!!rec); });
    return () => { alive = false; };
  }, []);

  const loadSaveList = async () => {
    setSaveListLoading(true);
    try {
      const result = await window.storage.list(SAVE_PREFIX);
      const keys = result?.keys || [];
      const saves: SaveListEntry[] = [];
      let totalBytes = 0;
      for (const key of keys) {
        try {
          const r = await window.storage.get(key);
          if (r?.value) {
            const size = estimateSize(r.value);
            totalBytes += size.bytes;
            const parsed = migrateSave(JSON.parse(r.value));
            saves.push({ key, size, ...parsed });
          }
        } catch (e) { dlog("saves:load-entry-error", key, e); }
      }
      saves.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setSaveList(saves);
      setSavesTotalBytes(totalBytes);
    } catch (e) {
      dlog("saves:load-list-error", e);
      setSaveList([]);
      setSavesTotalBytes(0);
    } finally {
      setSaveListLoading(false);
    }
  };

  const openSavesModal = async () => {
    setShowSaves(true);
    await loadSaveList();
  };

  const saveCurrent = async (args: SaveCurrentArgs) => {
    const { premise, entries } = args;
    if (!premise || entries.length === 0) return;
    const id = Date.now().toString(36);
    const key = SAVE_PREFIX + id;
    try {
      const existing = await window.storage.list(SAVE_PREFIX);
      const existingCount = existing?.keys?.length || 0;
      if (existingCount >= SAVE_CAP) {
        setSaveBanner({
          kind: "err",
          text: `${SAVE_CAP} hours already kept — release one to make room.`
        });
        await openSavesModal();
        return;
      }
    } catch {}
    // Persist illustration bytes as Blobs in IndexedDB (keyed `${id}:${index}`),
    // leaving only a tiny `idb:` marker in the save JSON. This keeps the
    // localStorage record small so a few illustrated saves can't blow the 5MB
    // cap. Falls back to inlining `data:` (today's behavior) if a write fails.
    const processedEntries = await Promise.all(entries.map(async (e, i) => {
      const ill = e.illustration;
      const base = { ...e, fullyRevealed: true };
      if (!ill || ill.status !== "ready" || typeof ill.url !== "string") {
        return { ...base, illustration: undefined };
      }
      if (ill.url.startsWith("idb:")) {
        // Already persisted (re-saving a save that never rehydrated); keep marker.
        return base;
      }
      if (ill.url.startsWith("blob:") || ill.url.startsWith("data:")) {
        try {
          const res = await fetch(ill.url);
          const blob = await res.blob();
          const imgKey = `${id}:${i}`;
          await putImage(imgKey, blob);
          return { ...base, illustration: { ...ill, url: `idb:${imgKey}` } };
        } catch {
          // IndexedDB unavailable/failed: inline `data:` as before; a `blob:`
          // can't be persisted as text, so drop it rather than bloat the save.
          return { ...base, illustration: ill.url.startsWith("data:") ? ill : undefined };
        }
      }
      return { ...base, illustration: undefined };
    }));
    const payload = buildSavePayload(premise, args, id, processedEntries);
    const serialized = JSON.stringify(payload);
    const size = estimateSize(serialized);
    try {
      await window.storage.set(key, serialized);
      setSaveBanner({
        kind: "ok",
        text: `The hour is set aside. (${formatKB(size.kb)} · ${formatTokens(size.tokens)})`
      });
      await loadSaveList();
    } catch (e) {
      // The text record failed to land; release any blobs we just wrote for it
      // so they don't linger orphaned in IndexedDB.
      deleteImagesForSave(id);
      const msg = (e as ThrownError)?.message || "";
      const looksQuota = /quota|limit|too large|size|5\s*mb/i.test(msg);
      setSaveBanner({
        kind: "err",
        text: looksQuota ? "Could not set the hour aside — the save exceeds the storage limit. Try releasing other hours first." : "Could not set the hour aside."
      });
    }
  };

  // ── Autosave slot ────────────────────────────────────────────────────────
  // One implicit slot that mirrors the live session so an interrupted hour (a
  // crash, a reload, the passphrase modal taking over) can be taken up again.
  // It lives outside SAVE_PREFIX, so it never appears in the manual saves list,
  // and is rewritten in place every settled turn.

  /** Read and migrate the autosave slot, or null when none is present. */
  const readAutosave = async (): Promise<SaveRecord | null> => {
    try {
      const compressed = await getDoc(AUTOSAVE_KEY);
      if (compressed) {
        const json = await decompressSave(compressed);
        return migrateSave(JSON.parse(json));
      }
      const r = await window.storage.get(AUTOSAVE_KEY);
      if (!r?.value) return null;
      return migrateSave(JSON.parse(r.value));
    } catch {
      return null;
    }
  };

  /**
   * Overwrite the autosave slot with the live session. Best-effort: a failed
   * write never surfaces a banner or interrupts play, since the player didn't
   * ask for it. Called from the useAutosave trigger after each settled turn.
   */
  const writeAutosave = async (args: SaveCurrentArgs) => {
    const { premise, entries } = args;
    if (!premise || entries.length === 0) return;
    const payload = buildSavePayload(premise, args, AUTOSAVE_ID, slimEntriesForAutosave(entries));
    const json = JSON.stringify(payload);
    try {
      const compressed = await compressSave(json);
      if (typeof compressed === "string") {
        await window.storage.set(AUTOSAVE_KEY, compressed);
      } else {
        await putDoc(AUTOSAVE_KEY, json);
      }
      setHasAutosave(true);
    } catch {
      // Autosave is silent by design — keep playing.
    }
  };

  /** Drop the autosave slot (a new hour is being started in its place). */
  const clearAutosave = async () => {
    try {
      await window.storage.delete(AUTOSAVE_KEY);
    } catch {}
    setHasAutosave(false);
  };

  const deleteSave = async (key: string, e: ReactSyntheticEvent) => {
    e.stopPropagation();
    try {
      await window.storage.delete(key);
      // Free the released hour's illustration blobs. The save id is the key tail.
      const saveId = key.startsWith(SAVE_PREFIX) ? key.slice(SAVE_PREFIX.length) : key;
      deleteImagesForSave(saveId);
      await loadSaveList();
    } catch {}
  };

  const exportChronicle = async ({ premise, entries, ended, metaMessages }: ExportChronicleArgs, includeMeta = false) => {
    if (!premise || entries.length === 0) return;
    const lines: string[] = [];
    lines.push(`# ${premise.title}`);
    lines.push(`*${premise.realmLabel} · The Borrowed Hour*`);
    lines.push("");
    if (premise.teaser) {
      lines.push(`> ${premise.teaser}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
    for (const entry of entries) {
      if (entry.type === "narration") {
        lines.push(entry.text.trim());
        lines.push("");
      } else if (entry.type === "action") {
        const safe = entry.text.trim().replace(/\n/g, "\n> ");
        lines.push(`> › ${safe}`);
        lines.push("");
      }
    }
    if (ended) {
      lines.push("---");
      lines.push("");
      lines.push("*❦ The hour is spent. ❦*");
      lines.push("");
    }
    const metaIncluded = includeMeta && metaMessages.length > 0;
    if (metaIncluded) {
      lines.push("---");
      lines.push("");
      lines.push("## Director's commentary");
      lines.push("");
      lines.push("*Conversation with the author of the hour, after its close.*");
      lines.push("");
      for (const m of metaMessages) {
        if (m.role === "user") {
          const safe = m.text.trim().replace(/\n/g, "\n> ");
          lines.push(`> **You:** ${safe}`);
          lines.push("");
        } else {
          lines.push(`**The author:** ${m.text.trim()}`);
          lines.push("");
        }
      }
    }
    const text = lines.join("\n");
    const okBannerText = metaIncluded ? "A copy of the chronicle and the commentary is on the clipboard." : "A copy of the chronicle is on the clipboard.";
    const tryClipboardAPI = async () => {
      if (!navigator.clipboard?.writeText) return false;
      try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    };
    const tryLegacyCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.width = "1px";
        ta.style.height = "1px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch { return false; }
    };
    if (await tryClipboardAPI()) {
      setSaveBanner({ kind: "ok", text: okBannerText });
      return;
    }
    if (tryLegacyCopy()) {
      setSaveBanner({ kind: "ok", text: okBannerText });
      return;
    }
    setExportFallbackText(text);
  };

  return {
    saveList,
    saveListLoading,
    saveBanner, setSaveBanner,
    savesTotalBytes,
    showSaves, setShowSaves,
    exportFallbackText, setExportFallbackText,
    loadSaveList,
    openSavesModal,
    saveCurrent,
    loadSave: null, // not used directly; App orchestrates load
    deleteSave,
    exportChronicle,
    hasAutosave,
    readAutosave,
    writeAutosave,
    clearAutosave,
  };
}
