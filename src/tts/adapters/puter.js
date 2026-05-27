import { BorrowedError } from "../../llm/errors.js";
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

// ── Puter adapter (free, one-time sign-in) ───────────────────────────────
let _puterReady = null;
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
  constructor({ voiceId, rate, engine }) {
    this.voiceId = voiceId || "Joanna";
    this.rate = rate || 1.0;
    this.engine = engine || "neural";
  }
  async synthesize(text, signal) {
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const puter = await _loadPuter();
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    // Puter.js v2 expects an options object as the second arg.
    const audio = await puter.ai.txt2speech(text.trim(), { voice: this.voiceId, engine: this.engine });
    if (signal?.aborted) { try { audio.pause(); } catch (_) {} throw Object.assign(new Error("Aborted"), { name: "AbortError" }); }
    let _onended = null;
    const finish = () => { if (_onended) _onended(); };
    audio.onended = finish;
    audio.onerror = () => {
      if (typeof console !== "undefined") console.warn("[tts] puter audio error:", audio.error?.code, audio.error?.message);
      finish();
    };
    const tryPlay = () => {
      let p;
      try { p = audio.play(); } catch (e) {
        if (typeof console !== "undefined") console.warn("[tts] puter audio.play() threw:", e?.message || e);
        return;
      }
      if (p && typeof p.catch === "function") {
        p.catch((e) => {
          if (typeof console !== "undefined") console.warn("[tts] puter audio.play() rejected:", e?.name || "", e?.message || e);
          finish();
        });
      }
    };
    const handle = {
      play: tryPlay,
      pause: () => { try { audio.pause(); } catch (_) {} },
      resume: tryPlay,
      stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} },
      set onended(cb) { _onended = cb; }
    };
    signal?.addEventListener("abort", handle.stop);
    return handle;
  }
  destroy() {}
}
