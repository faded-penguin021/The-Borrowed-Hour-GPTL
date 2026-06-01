// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY DEBUG INSTRUMENTATION — remove once the turn-submission bug is fixed.
//
// A tiny in-memory ring buffer that mirrors console output and global errors so
// a mobile user (no devtools) can read and copy them from an on-screen overlay
// (see src/components/DebugOverlay.tsx). Import for side effects early in
// main.tsx; call `dlog(...)` for explicit breadcrumbs in the code under test.
// ─────────────────────────────────────────────────────────────────────────

export type DebugEntry = { t: number; level: string; msg: string };

const MAX = 400;
const buffer: DebugEntry[] = [];
const listeners = new Set<() => void>();

function safeStringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, (_k, val) => (val instanceof Error ? `${val.name}: ${val.message}` : val));
  } catch {
    return String(v);
  }
}

function push(level: string, args: unknown[]) {
  const msg = args.map(safeStringify).join(" ");
  buffer.push({ t: Date.now(), level, msg });
  if (buffer.length > MAX) buffer.shift();
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

/** Explicit breadcrumb from instrumented code. */
export function dlog(...args: unknown[]) {
  push("dbg", args);
}

export function getDebugEntries(): DebugEntry[] {
  return buffer.slice();
}

export function clearDebug() {
  buffer.length = 0;
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
