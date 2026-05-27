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
export function _blobHandle(blob, signal) {
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
    if (typeof console !== "undefined") {
      console.warn("[tts] audio element error:", { code, msg, type: typed.type, size: typed.size });
    }
    cleanup();
    if (_onended) _onended();
  };
  const tryPlay = () => {
    let p;
    try { p = audio.play(); } catch (e) {
      if (typeof console !== "undefined") console.warn("[tts] audio.play() threw:", e?.message || e);
      return;
    }
    if (p && typeof p.catch === "function") {
      p.catch((e) => {
        if (typeof console !== "undefined") {
          console.warn("[tts] audio.play() rejected:", e?.name || "", e?.message || e);
        }
        // Treat a rejected play() (autoplay block / decode failure) as end-of-playback
        // so the controller releases activeHandle instead of looking stuck.
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
