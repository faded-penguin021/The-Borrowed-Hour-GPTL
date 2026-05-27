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
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let _onended = null;
  const cleanup = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
  audio.onended = () => { cleanup(); if (_onended) _onended(); };
  const handle = {
    play: () => { try { audio.play(); } catch (_) {} },
    pause: () => { try { audio.pause(); } catch (_) {} },
    resume: () => { try { audio.play(); } catch (_) {} },
    stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} cleanup(); },
    set onended(cb) { _onended = cb; }
  };
  signal?.addEventListener("abort", handle.stop);
  return handle;
}
