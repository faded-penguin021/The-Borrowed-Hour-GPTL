import { useState } from "react";
import type { SyntheticEvent as ReactSyntheticEvent } from "react";
import type {
  ChatMessage, CodexSnapshot, Entry, GameState, MetaMessage, Premise,
  SaveBanner, SaveListEntry, ThrownError
} from "../types";
import { SAVE_PREFIX, SAVE_CAP, estimateSize, formatKB, formatTokens } from "../data/constants";
import { putImage, deleteImagesForSave } from "../storage/imageStore";
import { migrateSave, CURRENT_SAVE_VERSION } from "../saves/migrate";

interface SaveCurrentArgs {
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

export function useSaves() {
  const [saveList, setSaveList] = useState<SaveListEntry[]>([]);
  const [saveListLoading, setSaveListLoading] = useState(false);
  const [saveBanner, setSaveBanner] = useState<SaveBanner | null>(null);
  const [savesTotalBytes, setSavesTotalBytes] = useState(0);
  const [showSaves, setShowSaves] = useState(false);
  const [exportFallbackText, setExportFallbackText] = useState<string | null>(null);

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
        } catch {}
      }
      saves.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setSaveList(saves);
      setSavesTotalBytes(totalBytes);
    } catch {
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

  const saveCurrent = async ({ premise, entries, ended, gameState, history, metaMessages, metaMode, language, codex }: SaveCurrentArgs) => {
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
    const payload = {
      id,
      premiseId: premise.id,
      premise,
      title: premise.title,
      realm: premise.realm,
      realmLabel: premise.realmLabel,
      isCustom: !!premise.isCustom,
      savedAt: Date.now(),
      turns: entries.filter((e) => e.type === "action").length,
      ended,
      gameState,
      entries: processedEntries,
      history,
      metaMessages: metaMessages.map((m) => ({ ...m, fullyRevealed: true })),
      metaMode,
      language,
      codex,
      schemaVersion: CURRENT_SAVE_VERSION
    };
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
  };
}
