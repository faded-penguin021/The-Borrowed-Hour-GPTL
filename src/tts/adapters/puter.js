// @ts-check
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

/** @type {Promise<any> | null} */
let _puterReady = null;
/** @returns {Promise<any>} */
export function _loadPuter() {
  if (_puterReady) return _puterReady;
  _puterReady = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.puter) return resolve(window.puter);
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.async = true;
    s.onload = () => { if (window.puter) resolve(window.puter); else reject(new Error("Puter SDK loaded but window.puter missing")); };
    s.onerror = () => reject(new Error("Puter SDK failed to load"));
    document.head.appendChild(s);
  });
  return _puterReady;
}
export class PuterTTSAdapter {
  /** @param {{ voiceId?: string | null, rate?: number, engine?: string }} opts */
  constructor({ voiceId, rate, engine }) {
    this.voiceId = voiceId || "Joanna";
    this.rate = rate || 1.0;
    this.engine = engine || "neural";
  }
  /** @param {string} text @param {AbortSignal} [signal] @param {(msg: string) => void} [onError] @returns {Promise<TTSHandle>} */
  async synthesize(text, signal, onError) {
    /** @param {string} m */
    const report = (m) => { try { onError?.(m); } catch (_) {} };
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const puter = await _loadPuter();
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    // Puter.js v2 expects an options object as the second arg.
    const audio = await puter.ai.txt2speech(text.trim(), { voice: this.voiceId, engine: this.engine });
    if (signal?.aborted) { try { audio.pause(); } catch (_) {} throw Object.assign(new Error("Aborted"), { name: "AbortError" }); }
    /** @type {(() => void) | null} */
    let _onended = null;
    const finish = () => { if (_onended) _onended(); };
    audio.onended = finish;
    audio.onerror = () => {
      /** @type {number | undefined} */
      const code = audio.error?.code;
      const msg = audio.error?.message;
      const codeName = (/** @type {Record<number, string>} */ ({ 1: "ABORTED", 2: "NETWORK", 3: "DECODE", 4: "SRC_NOT_SUPPORTED" }))[code ?? -1] || `code=${code}`;
      const info = `puter audio ${codeName}${msg ? ` — ${msg}` : ""}`;
      if (typeof console !== "undefined") console.warn("[tts]", info);
      report(info);
      finish();
    };
    const tryPlay = () => {
      let p;
      try { p = audio.play(); } catch (e) {
        const info = `puter play() threw: ${e?.message || e}`;
        if (typeof console !== "undefined") console.warn("[tts]", info);
        report(info);
        return;
      }
      if (p && typeof p.catch === "function") {
        p.catch((/** @type {any} */ e) => {
          const info = `puter play() rejected: ${e?.name || ""}${e?.message ? ` — ${e.message}` : ""}`;
          if (typeof console !== "undefined") console.warn("[tts]", info);
          report(info);
          finish();
        });
      }
    };
    /** @type {TTSHandle} */
    const handle = {
      play: tryPlay,
      pause: () => { try { audio.pause(); } catch (_) {} },
      resume: tryPlay,
      stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} },
      set onended(/** @type {(() => void) | null} */ cb) { _onended = cb; }
    };
    signal?.addEventListener("abort", handle.stop);
    return handle;
  }
  destroy() {}
}
