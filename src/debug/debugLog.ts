// ─────────────────────────────────────────────────────────────────────────
// DEBUG INSTRUMENTATION — powers the opt-in on-screen debug overlay.
//
// A tiny in-memory ring buffer that mirrors console output and global errors so
// a mobile user (no devtools) can read and copy them from an on-screen overlay
// (see src/components/DebugOverlay.tsx, toggled from Settings). Import for side
// effects early in main.tsx; call `dlog(...)` for explicit breadcrumbs.
// ─────────────────────────────────────────────────────────────────────────

export type DebugEntry = { t: number; level: string; msg: string };

const MAX = 400;
const buffer: DebugEntry[] = [];
const listeners = new Set<() => void>();

// Cached immutable snapshot for useSyncExternalStore. getSnapshot MUST return a
// stable reference between mutations, or React re-renders forever (error #185).
let snapshot: DebugEntry[] = [];
function refreshSnapshot() {
  snapshot = buffer.slice();
}

function describeError(e: Error): string {
  let s = `${e.name}: ${e.message}`;
  // Surface domain-specific fields (BorrowedError carries the actionable text).
  const detail = (e as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail) s += ` | detail: ${detail}`;
  const raw = (e as { raw?: unknown }).raw;
  if (raw != null) {
    const rawStr = typeof raw === "string" ? raw : (() => { try { return JSON.stringify(raw); } catch { return String(raw); } })();
    s += ` | raw: ${rawStr.slice(0, 300)}`;
  }
  // First non-message line of the stack pinpoints the throw site.
  const stackLine = e.stack?.split("\n").find((l) => /\s+at\s/.test(l));
  if (stackLine) s += ` | ${stackLine.trim()}`;
  return s;
}

function safeStringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Error) return describeError(v);
  try {
    return JSON.stringify(v, (_k, val) => (val instanceof Error ? describeError(val) : val));
  } catch {
    return String(v);
  }
}

function push(level: string, args: unknown[]) {
  const msg = args.map(safeStringify).join(" ");
  buffer.push({ t: Date.now(), level, msg });
  if (buffer.length > MAX) buffer.shift();
  refreshSnapshot();
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

/** Explicit breadcrumb from instrumented code. */
export function dlog(...args: unknown[]) {
  push("dbg", args);
}

export function getDebugEntries(): DebugEntry[] {
  return snapshot;
}

export function clearDebug() {
  buffer.length = 0;
  refreshSnapshot();
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

export function subscribeDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let installed = false;

/** Patch console + global error handlers. Idempotent. */
export function installDebugCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const methods: Array<"log" | "info" | "warn" | "error" | "debug"> = ["log", "info", "warn", "error", "debug"];
  for (const m of methods) {
    const orig = console[m]?.bind(console);
    console[m] = (...args: unknown[]) => {
      push(m, args);
      orig?.(...args);
    };
  }

  window.addEventListener("error", (e) => {
    push("error", [`window.onerror: ${e.message}`, e.filename ? `@ ${e.filename}:${e.lineno}:${e.colno}` : "", e.error]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    push("error", ["unhandledrejection:", (e as PromiseRejectionEvent).reason]);
  });

  dlog("debug capture installed");
}
