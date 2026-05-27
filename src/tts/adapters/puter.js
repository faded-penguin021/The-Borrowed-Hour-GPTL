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
    audio.onended = () => { if (_onended) _onended(); };
    const handle = {
      play: () => { try { audio.play(); } catch (_) {} },
      pause: () => { try { audio.pause(); } catch (_) {} },
      resume: () => { try { audio.play(); } catch (_) {} },
      stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} },
      set onended(cb) { _onended = cb; audio.onended = () => { if (_onended) _onended(); }; }
    };
    signal?.addEventListener("abort", handle.stop);
    return handle;
  }
  destroy() {}
}
