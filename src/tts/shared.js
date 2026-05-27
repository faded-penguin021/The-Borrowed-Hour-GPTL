import { BorrowedError } from "../llm/errors.js";

// ── Shared cloud adapter helpers (fetch → blob → Audio element) ──────────
export async function _fetchAudioBlob(url, init, signal) {
  const resp = await fetch(url, { ...init, signal });
  if (!resp.ok) {
    let detail = "";
    try { const txt = await resp.text(); detail = txt.slice(0, 200); } catch (_) {}
    throw new BorrowedError(`TTS request failed (HTTP ${resp.status})`, detail);
  }
  return resp.blob();
}
export function _blobHandle(blob, signal, onError) {
  const report = (m) => { try { onError?.(m); } catch (_) {} };
  // Force a known audio MIME type. Some providers return application/octet-stream
  // or omit the content-type, which makes Safari/iOS refuse to decode the blob
  // URL silently — the Audio element never fires `playing`, just an `error`.
  const typed = (blob && blob.type && blob.type.startsWith("audio/"))
    ? blob
    : new Blob([blob], { type: "audio/mpeg" });
  const url = URL.createObjectURL(typed);
  const audio = new Audio(url);
  audio.preload = "auto";
  let _onended = null;
  const cleanup = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
  audio.onended = () => { cleanup(); if (_onended) _onended(); };
  audio.onerror = () => {
    const err = audio.error;
    const code = err?.code, msg = err?.message;
    const codeName = ({ 1: "ABORTED", 2: "NETWORK", 3: "DECODE", 4: "SRC_NOT_SUPPORTED" })[code] || `code=${code}`;
    const info = `audio ${codeName}${msg ? ` — ${msg}` : ""} (type=${typed.type}, ${typed.size}B)`;
    if (typeof console !== "undefined") console.warn("[tts]", info);
    report(info);
    cleanup();
    if (_onended) _onended();
  };
  const tryPlay = () => {
    let p;
    try { p = audio.play(); } catch (e) {
      const info = `play() threw: ${e?.message || e}`;
      if (typeof console !== "undefined") console.warn("[tts]", info);
      report(info);
      return;
    }
    if (p && typeof p.catch === "function") {
      p.catch((e) => {
        const info = `play() rejected: ${e?.name || ""}${e?.message ? ` — ${e.message}` : ""}`;
        if (typeof console !== "undefined") console.warn("[tts]", info);
        report(info);
        cleanup();
        if (_onended) _onended();
      });
    }
  };
  const handle = {
    play: tryPlay,
    pause: () => { try { audio.pause(); } catch (_) {} },
    resume: tryPlay,
    stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} cleanup(); },
    set onended(cb) { _onended = cb; }
  };
  signal?.addEventListener("abort", handle.stop);
  return handle;
}
