// ─────────────────────────────────────────────────────────────────────────
// DEBUG OVERLAY — opt-in panel surfaced through Settings.
//
// A floating, mobile-friendly panel that shows captured logs/errors with a
// Copy button so the user can paste them back. All inline styles + very high
// z-index so it survives even if app CSS is broken.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { getDebugEntries, subscribeDebug, clearDebug, type DebugEntry } from "../debug/debugLog";

function useEntries(): DebugEntry[] {
  return useSyncExternalStore(subscribeDebug, getDebugEntries, getDebugEntries);
}

const levelColor: Record<string, string> = {
  error: "text-[#ff8a8a]",
  warn: "text-[#ffd479]",
  dbg: "text-[#8ad6ff]",
  info: "text-[#cfcfcf]",
  log: "text-[#e8e8e8]",
  debug: "text-[#b0b0b0]",
};

export function DebugOverlay({ enabled = false }: { enabled?: boolean }) {
  const entries = useEntries();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const errorCount = entries.filter((e) => e.level === "error").length;

  // Auto-open the first time an error is captured so it can't be missed.
  useEffect(() => {
    if (enabled && errorCount > 0) setOpen(true);
  }, [enabled, errorCount]);

  // Off by default; opt in via Settings → Debug log overlay. Capture itself
  // stays always-on (installed in main.tsx), so the buffer is already populated
  // the moment this is switched on.
  if (!enabled) return null;

  const asText = () =>
    entries
      .map((e) => `${new Date(e.t).toISOString().slice(11, 23)} [${e.level}] ${e.msg}`)
      .join("\n");

  const copy = async () => {
    const text = asText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked; fall back to a selectable prompt.
      try { window.prompt("Copy the debug log:", text); } catch { /* ignore */ }
    }
  };

  const btnBase =
    "fixed bottom-2 right-2 z-[2147483647] py-2 px-3 text-[12px] font-mono rounded-lg " +
    "border border-white/30 text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)]";

  if (!open) {
    return (
      <button
        className={`${btnBase} ${errorCount > 0 ? "bg-[#7a1d1d]" : "bg-[rgba(20,20,30,0.9)]"}`}
        onClick={() => setOpen(true)}
      >
        DEBUG{errorCount > 0 ? ` ⚠${errorCount}` : ` (${entries.length})`}
      </button>
    );
  }

  return (
    <div className="fixed left-0 right-0 bottom-0 h-[55vh] z-[2147483647] flex flex-col bg-[#08080e]/[0.97] border-t border-white/25 text-[#e8e8e8] font-mono text-[11px]">
      <div className="flex gap-2 items-center py-2 px-2.5 border-b border-white/15">
        <strong className="flex-1">Debug log ({entries.length})</strong>
        <button onClick={copy} className={miniBtn}>{copied ? "Copied!" : "Copy"}</button>
        <button onClick={async () => {
          const promptEntries = entries.filter((e) => e.level === "dbg" && e.msg.startsWith("prompt:"));
          if (promptEntries.length === 0) return;
          const text = promptEntries.map((e) => `${new Date(e.t).toISOString().slice(11, 23)} ${e.msg}`).join("\n");
          try { await navigator.clipboard.writeText(text); setPromptCopied(true); setTimeout(() => setPromptCopied(false), 1500); } catch {}
        }} className={miniBtn}>{promptCopied ? "Copied!" : "Prompts"}</button>
        <button onClick={() => clearDebug()} className={miniBtn}>Clear</button>
        <button onClick={() => setOpen(false)} className={miniBtn}>Close</button>
      </div>
      <div className="flex-1 overflow-y-auto py-1.5 px-2.5 [-webkit-overflow-scrolling:touch]">
        {entries.length === 0 ? (
          <div className="opacity-60">No log entries yet.</div>
        ) : (
          entries.map((e, i) => (
            <div key={i} className="whitespace-pre-wrap break-words mb-0.5">
              <span className="opacity-50">{new Date(e.t).toISOString().slice(14, 23)} </span>
              <span className={levelColor[e.level] || "text-[#e8e8e8]"}>[{e.level}] </span>
              {e.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const miniBtn =
  "py-1 px-2.5 text-[12px] font-mono rounded-md border border-white/30 bg-[#282837]/95 text-white";
