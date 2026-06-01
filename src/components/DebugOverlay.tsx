// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY DEBUG OVERLAY — remove once the turn-submission bug is fixed.
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
  error: "#ff8a8a",
  warn: "#ffd479",
  dbg: "#8ad6ff",
  info: "#cfcfcf",
  log: "#e8e8e8",
  debug: "#b0b0b0",
};

export function DebugOverlay({ enabled = false }: { enabled?: boolean }) {
  const entries = useEntries();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const btn: React.CSSProperties = {
    position: "fixed",
    bottom: 8,
    right: 8,
    zIndex: 2147483647,
    padding: "8px 12px",
    fontSize: 12,
    fontFamily: "monospace",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.3)",
    background: errorCount > 0 ? "#7a1d1d" : "rgba(20,20,30,0.9)",
    color: "#fff",
    boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
  };

  if (!open) {
    return (
      <button style={btn} onClick={() => setOpen(true)}>
        DEBUG{errorCount > 0 ? ` ⚠${errorCount}` : ` (${entries.length})`}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "55vh",
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        background: "rgba(8,8,14,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.25)",
        color: "#e8e8e8",
        fontFamily: "monospace",
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <strong style={{ flex: 1 }}>Debug log ({entries.length})</strong>
        <button onClick={copy} style={miniBtn}>{copied ? "Copied!" : "Copy"}</button>
        <button onClick={() => clearDebug()} style={miniBtn}>Clear</button>
        <button onClick={() => setOpen(false)} style={miniBtn}>Close</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px", WebkitOverflowScrolling: "touch" }}>
        {entries.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No log entries yet.</div>
        ) : (
          entries.map((e, i) => (
            <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 2 }}>
              <span style={{ opacity: 0.5 }}>{new Date(e.t).toISOString().slice(14, 23)} </span>
              <span style={{ color: levelColor[e.level] || "#e8e8e8" }}>[{e.level}] </span>
              {e.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  fontFamily: "monospace",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "rgba(40,40,55,0.95)",
  color: "#fff",
};
