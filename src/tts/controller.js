import { TTS_PROVIDER_META } from "./catalogue.js";
import { getTtsElevenLabsKey } from "./elevenLabsKey.js";
import { BorrowedError } from "../llm/errors.js";

// ── TTSController ────────────────────────────────────────────────────────
export class TTSController {
  constructor() {
    this.providerId = "browser";
    this.adapter = null;
    this.voiceId = null;
    this.rate = 1.0;
    this.key = null;
    this.model = null; // per-provider model override; null → use catalogue default
    this.enabled = false;
    this.muted = false;
    this.activeHandle = null;
    this.activeAbort = null;
    this.activeTurnId = null;
    this.paused = false;
    this.loading = false;
    this.loadingTurnId = null;
    this.lastError = null;
    this.lastErrorTurnId = null;
    this._onSpeakStart = new Set();
    this._onSpeakEnd = new Set();
    this._onStateChange = new Set();
  }
  setProvider(id, { voiceId, key, model } = {}) {
    if (this.providerId === id && this.adapter && this.key === key && this.voiceId === voiceId && (model === undefined || this.model === (model || null))) return;
    this.stop();
    this.providerId = id;
    if (voiceId != null) this.voiceId = voiceId;
    this.key = key != null ? key : null;
    if (model !== undefined) this.model = model || null;
    this.adapter = null;
  }
  setVoice(id) { this.voiceId = id || null; this.adapter = null; }
  setModel(m) { this.model = m || null; this.adapter = null; }
  setRate(r) { this.rate = Math.max(0.5, Math.min(2.0, +r || 1)); this.adapter = null; }
  setKey(k) { this.key = k || null; this.adapter = null; }
  setEnabled(on) { this.enabled = !!on; if (!on) this.stop(); }
  setMuted(m) { this.muted = !!m; if (m) this.stop(); }
  onSpeakStart(cb) { this._onSpeakStart.add(cb); return () => this._onSpeakStart.delete(cb); }
  onSpeakEnd(cb)   { this._onSpeakEnd.add(cb);   return () => this._onSpeakEnd.delete(cb); }
  onStateChange(cb) { this._onStateChange.add(cb); return () => this._onStateChange.delete(cb); }
  isSpeaking() { return !!this.activeHandle && !this.paused; }
  isPaused()   { return !!this.activeHandle && this.paused; }
  isLoading()  { return !!this.loading; }
  loadingFor() { return this.loading ? this.loadingTurnId : null; }
  reportError(msg) {
    this.lastError = String(msg || "").slice(0, 200);
    this.lastErrorTurnId = this.activeTurnId;
    this._notifyState();
  }
  clearError() {
    if (!this.lastError) return;
    this.lastError = null;
    this.lastErrorTurnId = null;
    this._notifyState();
  }
  pause() {
    if (!this.activeHandle || this.paused) return;
    try { this.activeHandle.pause?.(); } catch (_) {}
    this.paused = true;
    this._notifyState();
  }
  resume() {
    if (!this.activeHandle || !this.paused) return;
    try { this.activeHandle.resume?.(); } catch (_) {}
    this.paused = false;
    this._notifyState();
  }
  async speak(text, { turnId } = {}) {
    if (!this.enabled || this.muted) return;
    if (!text || !text.trim()) return;
    this.stop();
    const meta = TTS_PROVIDER_META[this.providerId];
    if (!meta) return;
    if (!this.adapter) {
      this.adapter = new meta.adapter({ voiceId: this.voiceId, rate: this.rate, key: this.key, model: this.model || meta.model });
    }
    const abort = new AbortController();
    this.activeAbort = abort;
    this.activeTurnId = turnId != null ? turnId : null;
    this.loading = true;
    this.loadingTurnId = turnId != null ? turnId : null;
    this.lastError = null;
    this.lastErrorTurnId = null;
    this._notifyState();
    try {
      const handle = await this.adapter.synthesize(text.trim(), abort.signal, (msg) => this.reportError(msg));
      this.loading = false;
      this.loadingTurnId = null;
      if (abort.signal.aborted) { try { handle.stop(); } catch (_) {} this._notifyState(); return; }
      this.activeHandle = handle;
      this.paused = false;
      handle.onended = () => this._endSpeak(turnId);
      this._startSpeak(turnId);
      handle.play();
      this._notifyState();
    } catch (e) {
      this.loading = false;
      this.loadingTurnId = null;
      if (e?.name === "AbortError") { this._notifyState(); return; }
      const msg = e?.message || String(e);
      const detail = e?.detail ? ` — ${e.detail}` : "";
      this.lastError = `synthesis: ${msg}${detail}`.slice(0, 200);
      this.lastErrorTurnId = turnId != null ? turnId : null;
      this._endSpeak(turnId);
      if (typeof console !== "undefined") console.warn("[tts] synthesis failed:", msg, detail);
    }
  }
  stop() {
    if (this.activeAbort) { try { this.activeAbort.abort(); } catch (_) {} this.activeAbort = null; }
    if (this.activeHandle) { try { this.activeHandle.stop(); } catch (_) {} this.activeHandle = null; }
    if (this.activeTurnId !== null) { this._endSpeak(this.activeTurnId); this.activeTurnId = null; }
    this.paused = false;
    this.loading = false;
    this.loadingTurnId = null;
    this._notifyState();
  }
  _startSpeak(t) { this._onSpeakStart.forEach((cb) => { try { cb(t); } catch (_) {} }); }
  _endSpeak(t)   {
    this.activeHandle = null;
    this.paused = false;
    this._onSpeakEnd.forEach((cb) => { try { cb(t); } catch (_) {} });
    this._notifyState();
  }
  _notifyState() { this._onStateChange.forEach((cb) => { try { cb(); } catch (_) {} }); }
  destroy() {
    this.stop();
    try { this.adapter?.destroy?.(); } catch (_) {}
    this.adapter = null;
    this._onSpeakStart.clear();
    this._onSpeakEnd.clear();
    this._onStateChange.clear();
  }
}
