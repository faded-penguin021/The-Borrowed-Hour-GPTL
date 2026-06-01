import type { TTSAdapter, TTSAdapterOptions, TTSHandle, ThrownError } from "../../types";

// Minimal shape of the Puter.js v2 SDK surface this adapter touches. The SDK
// ships no published types; we describe only the `ai.txt2speech` entry point
// (and the HTMLAudioElement-like object it resolves to) rather than reaching
// for `any` at the untyped boundary.
interface PuterAudio {
  onended: (() => void) | null;
  onerror: (() => void) | null;
  error?: { code?: number; message?: string } | null;
  play(): Promise<void> | void;
  pause(): void;
  currentTime: number;
}
interface PuterSDK {
  ai: { txt2speech(text: string, opts: { voice: string; engine: string }): Promise<PuterAudio> };
}

let _puterReady: Promise<PuterSDK> | null = null;
export function _loadPuter(): Promise<PuterSDK> {
  if (_puterReady) return _puterReady;
  _puterReady = new Promise((resolve, reject) => {
    const win = window as unknown as { puter?: PuterSDK };
    if (typeof window !== "undefined" && win.puter) return resolve(win.puter);
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.async = true;
    s.onload = () => { if (win.puter) resolve(win.puter); else reject(new Error("Puter SDK loaded but window.puter missing")); };
    s.onerror = () => reject(new Error("Puter SDK failed to load"));
    document.head.appendChild(s);
  });
  return _puterReady;
}
export class PuterTTSAdapter implements TTSAdapter {
  voiceId: string;
  rate: number;
  engine: string;
  constructor({ voiceId, rate, engine }: TTSAdapterOptions & { engine?: string }) {
    this.voiceId = voiceId || "Joanna";
    this.rate = rate || 1.0;
    this.engine = engine || "neural";
  }
  async synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle> {
    const report = (m: string) => { try { onError?.(m); } catch (_) {} };
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const puter = await _loadPuter();
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    // Puter.js v2 expects an options object as the second arg.
    const audio = await puter.ai.txt2speech(text.trim(), { voice: this.voiceId, engine: this.engine });
    if (signal?.aborted) { try { audio.pause(); } catch (_) {} throw Object.assign(new Error("Aborted"), { name: "AbortError" }); }
    let _onended: (() => void) | null = null;
    const finish = () => { if (_onended) _onended(); };
    audio.onended = finish;
    audio.onerror = () => {
      const code: number | undefined = audio.error?.code;
      const msg = audio.error?.message;
      const codeName = ({ 1: "ABORTED", 2: "NETWORK", 3: "DECODE", 4: "SRC_NOT_SUPPORTED" } as Record<number, string>)[code ?? -1] || `code=${code}`;
      const info = `puter audio ${codeName}${msg ? ` — ${msg}` : ""}`;
      if (typeof console !== "undefined") console.warn("[tts]", info);
      report(info);
      finish();
    };
    const tryPlay = () => {
      let p;
      try { p = audio.play(); } catch (e) {
        const info = `puter play() threw: ${(e as ThrownError)?.message || e}`;
        if (typeof console !== "undefined") console.warn("[tts]", info);
        report(info);
        return;
      }
      if (p && typeof p.catch === "function") {
        p.catch((e: ThrownError) => {
          const info = `puter play() rejected: ${e?.name || ""}${e?.message ? ` — ${e.message}` : ""}`;
          if (typeof console !== "undefined") console.warn("[tts]", info);
          report(info);
          finish();
        });
      }
    };
    const handle: TTSHandle = {
      play: tryPlay,
      pause: () => { try { audio.pause(); } catch (_) {} },
      resume: tryPlay,
      stop: () => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} },
      set onended(cb: (() => void) | null) { _onended = cb; }
    };
    signal?.addEventListener("abort", handle.stop);
    return handle;
  }
  destroy() {}
}
