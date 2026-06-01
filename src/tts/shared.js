// @ts-check
/**
 * @import { TTSHandle, ThrownError } from "../types"
 */
import { BorrowedError } from "../llm/errors.js";

/**
 * @param {string} url
 * @param {RequestInit} init
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function _fetchAudioBlob(url, init, signal) {
  const resp = await fetch(url, { ...init, signal });
  if (!resp.ok) {
    let detail = "";
    try { const txt = await resp.text(); detail = txt.slice(0, 200); } catch (_) {}
    throw new BorrowedError(`TTS request failed (HTTP ${resp.status})`, detail);
  }
  return resp.blob();
}
/**
 * @param {Blob} blob
 * @param {AbortSignal} [signal]
 * @param {(msg: string) => void} [onError]
 * @returns {TTSHandle}
 */
export function _blobHandle(blob, signal, onError) {
  /** @param {string} m */
  const report = (m) => { try { onError?.(m); } catch (_) {} };
  // Sniff the first bytes so we can report the actual audio format, not
  // just the (often wrong or missing) Content-Type header.
  let magic = "";
  /** @type {string | null} */
  let sniffed = null;
  const sniffPromise = blob.slice(0, 12).arrayBuffer().then((buf) => {
    const b = new Uint8Array(buf);
    magic = Array.from(b.slice(0, 4)).map((x) => x.toString(16).padStart(2, "0")).join(" ");
    // ID3 or sync-frame → MP3; RIFF…WAVE → WAV; OggS → OGG/Opus; fLaC → FLAC
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) sniffed = "audio/mpeg";        // "ID3"
    else if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) sniffed = "audio/mpeg";           // MPEG sync
    else if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) sniffed = "audio/wav"; // "RIFF"
    else if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) sniffed = "audio/ogg"; // "OggS"
    else if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) sniffed = "audio/flac"; // "fLaC"
  }).catch(() => {});
  // Re-wrap with the sniffed type when known, otherwise trust the response's
  // type if it's an audio/* one, else default to mpeg. Some providers omit
  // Content-Type entirely and Safari/iOS then refuses to decode silently.
  const buildTyped = () => {
    if (sniffed) return new Blob([blob], { type: sniffed });
    if (blob.type && blob.type.startsWith("audio/")) return blob;
    return new Blob([blob], { type: "audio/mpeg" });
  };
  let typed = buildTyped();
  let url = URL.createObjectURL(typed);
  const audio = new Audio(url);
  audio.preload = "auto";
  /** @type {(() => void) | null} */
  let _onended = null;
  const cleanup = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
  // If sniff finishes after Audio is created, re-point the element so the
  // right MIME type reaches the decoder.
  sniffPromise.then(() => {
    if (!sniffed || typed.type === sniffed) return;
    try { URL.revokeObjectURL(url); } catch (_) {}
    typed = buildTyped();
    url = URL.createObjectURL(typed);
    audio.src = url;
  });
  const fmtBlobInfo = () => `type=${typed.type}, ${typed.size}B, magic=${magic || "?"}`;
  audio.onended = () => { cleanup(); if (_onended) _onended(); };
  audio.onerror = () => {
    const err = audio.error;
    const code = err?.code, msg = err?.message;
    const codeName = ({ 1: "ABORTED", 2: "NETWORK", 3: "DECODE", 4: "SRC_NOT_SUPPORTED" })[code ?? 0] || `code=${code}`;
    const info = `audio ${codeName}${msg ? ` — ${msg}` : ""} (${fmtBlobInfo()})`;
    if (typeof console !== "undefined") console.warn("[tts]", info);
    report(info);
    cleanup();
    if (_onended) _onended();
  };
  const tryPlay = async () => {
    // Make sure the sniff has resolved before play(), so the element gets the
    // right MIME type assigned. Otherwise the very first play() can race with
    // src re-assignment and Safari fires NotSupportedError on the stale URL.
    try { await sniffPromise; } catch (_) {}
    let p;
    try { p = audio.play(); } catch (e) {
      const info = `play() threw: ${/** @type {ThrownError} */ (e)?.message || e} (${fmtBlobInfo()})`;
      if (typeof console !== "undefined") console.warn("[tts]", info);
      report(info);
      return;
    }
    if (p && typeof p.catch === "function") {
      p.catch((e) => {
        const info = `play() rejected: ${e?.name || ""}${e?.message ? ` — ${e.message}` : ""} (${fmtBlobInfo()})`;
        if (typeof console !== "undefined") console.warn("[tts]", info);
        report(info);
        cleanup();
        if (_onended) _onended();
      });
    }
  };
  /** @type {TTSHandle} */
  const handle = {
    play: tryPlay,
    pause: () => { try { audio.pause(); } catch (_) {} },
    resume: tryPlay,
    stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} cleanup(); },
    set onended(/** @type {(() => void) | null} */ cb) { _onended = cb; }
  };
  signal?.addEventListener("abort", handle.stop);
  return handle;
}
