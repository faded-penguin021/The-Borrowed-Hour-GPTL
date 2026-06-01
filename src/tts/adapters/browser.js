// @ts-check
export class BrowserTTSAdapter {
  /** @param {TTSAdapterOptions} opts */
  constructor({ voiceId, rate }) {
    this.synth = (typeof window !== "undefined" && "speechSynthesis" in window) ? window.speechSynthesis : null;
    this.voiceId = voiceId || null;
    this.rate = rate || 1.0;
  }
  /** @param {string} text @param {AbortSignal} [signal] @returns {Promise<TTSHandle>} */
  async synthesize(text, signal) {
    if (!this.synth) throw new Error("Web Speech API unavailable");
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const synth = this.synth;
    const utt = new SpeechSynthesisUtterance(text.trim());
    const voices = synth.getVoices() || [];
    if (this.voiceId) utt.voice = voices.find((v) => v.name === this.voiceId) || null;
    utt.rate = Math.max(0.5, Math.min(2.0, this.rate));
    let _onended = null;
    const clear = () => { if (_onended) _onended(); };
    utt.onend = clear;
    utt.onerror = clear;
    const handle = {
      play: () => { try { synth.speak(utt); } catch (_) { clear(); } },
      pause: () => { try { synth.pause(); } catch (_) {} },
      resume: () => { try { synth.resume(); } catch (_) {} },
      stop: () => { try { synth.cancel(); } catch (_) {} },
      set onended(cb) { _onended = cb; }
    };
    signal?.addEventListener("abort", handle.stop);
    return handle;
  }
  destroy() {}
}
