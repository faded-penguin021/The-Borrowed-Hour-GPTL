// @ts-check
import { useState } from "react";
import { SAVE_PREFIX, SAVE_CAP, estimateSize, formatKB, formatTokens } from "../data/constants.js";

/**
 * @returns {{
 *   saveList: any[],
 *   saveListLoading: boolean,
 *   saveBanner: {kind: string, text: string} | null,
 *   setSaveBanner: Function,
 *   savesTotalBytes: number,
 *   showSaves: boolean,
 *   setShowSaves: Function,
 *   exportFallbackText: string | null,
 *   setExportFallbackText: Function,
 *   loadSaveList: () => Promise<void>,
 *   openSavesModal: () => Promise<void>,
 *   saveCurrent: (args: {premise: any, entries: any[], ended: boolean, gameState: any, history: any[], metaMessages: any[], metaMode: boolean, language: string, codex: any}) => Promise<void>,
 *   loadSave: (save: any, callbacks: any) => Promise<void>,
 *   deleteSave: (key: string, e: any) => Promise<void>,
 *   exportChronicle: (args: {premise: any, entries: any[], ended: boolean, metaMessages: any[]}, includeMeta?: boolean) => Promise<void>,
 * }}
 */
export function useSaves() {
  const [saveList, setSaveList] = useState([]);
  const [saveListLoading, setSaveListLoading] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);
  const [savesTotalBytes, setSavesTotalBytes] = useState(0);
  const [showSaves, setShowSaves] = useState(false);
  const [exportFallbackText, setExportFallbackText] = useState(null);

  const loadSaveList = async () => {
    setSaveListLoading(true);
    try {
      const result = await window.storage.list(SAVE_PREFIX);
      const keys = result?.keys || [];
      const saves = [];
      let totalBytes = 0;
      for (const key of keys) {
        try {
          const r = await window.storage.get(key);
          if (r?.value) {
            const size = estimateSize(r.value);
            totalBytes += size.bytes;
            const parsed = JSON.parse(r.value);
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

  const saveCurrent = async ({ premise, entries, ended, gameState, history, metaMessages, metaMode, language, codex }) => {
    if (!premise || entries.length === 0) return;
    const id = Date.now().toString(36);
    const key = SAVE_PREFIX + id;
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
      entries: entries.map((e) => {
        const ill = e.illustration && e.illustration.status === "ready" && typeof e.illustration.url === "string" && e.illustration.url.startsWith("data:")
          ? e.illustration
          : undefined;
        return { ...e, fullyRevealed: true, illustration: ill };
      }),
      history,
      metaMessages: metaMessages.map((m) => ({ ...m, fullyRevealed: true })),
      metaMode,
      language,
      codex
    };
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
      const msg = e && e.message || "";
      const looksQuota = /quota|limit|too large|size|5\s*mb/i.test(msg);
      setSaveBanner({
        kind: "err",
        text: looksQuota ? "Could not set the hour aside — the save exceeds the storage limit. Try releasing other hours first." : "Could not set the hour aside."
      });
    }
  };

  const deleteSave = async (key, e) => {
    e.stopPropagation();
    try {
      await window.storage.delete(key);
      await loadSaveList();
    } catch {}
  };

  const exportChronicle = async ({ premise, entries, ended, metaMessages }, includeMeta = false) => {
    if (!premise || entries.length === 0) return;
    const lines = [];
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
    loadSave: /** @type {any} */ (null), // not used directly; App orchestrates load
    deleteSave,
    exportChronicle,
  };
}
