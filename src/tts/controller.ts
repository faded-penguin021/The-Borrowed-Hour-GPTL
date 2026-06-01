import type { TTSAdapter, TTSHandle, ThrownError } from "../types";
import { TTS_PROVIDER_META } from "./catalogue";

export class TTSController {
  providerId: string;
  adapter: TTSAdapter | null;
  voiceId: string | null;
  rate: number;
  key: string | null;
  region: string | null;
  model: string | null;
  enabled: boolean;
  muted: boolean;
  activeHandle: TTSHandle | null;
  activeAbort: AbortController | null;
  activeTurnId: number | null;
  paused: boolean;
  loading: boolean;
  loadingTurnId: number | null;
  lastError: string | null;
  lastErrorTurnId: number | null;
  _onSpeakStart: Set<(turnId?: number | null) => void>;
  _onSpeakEnd: Set<(turnId?: number | null) => void>;
  _onStateChange: Set<() => void>;

  constructor() {
    this.providerId = "browser";
    this.adapter = null;
    this.voiceId = null;
    this.rate = 1.0;
    this.key = null;
    this.region = null;
    this.model = null;
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
  setProvider(id: string, { voiceId, key, model, region }: { voiceId?: string | null, key?: string | null, model?: string | null, region?: string | null } = {}) {
    if (this.providerId === id && this.adapter && this.key === key && this.voiceId === voiceId && (model === undefined || this.model === (model || null)) && (region === undefined || this.region === (region || null))) return;
    this.stop();
    this.providerId = id;
    if (voiceId != null) this.voiceId = voiceId;
    this.key = key != null ? key : null;
    if (model !== undefined) this.model = model || null;
    if (region !== undefined) this.region = region || null;
    this.adapter = null;
  }
  setVoice(id?: string | null) { this.voiceId = id || null; this.adapter = null; }
  setModel(m?: string | null) { this.model = m || null; this.adapter = null; }
  setRate(r: number | string) { this.rate = Math.max(0.5, Math.min(2.0, +r || 1)); this.adapter = null; }
  setKey(k?: string | null) { this.key = k || null; this.adapter = null; }
  setEnabled(on: boolean) { this.enabled = !!on; if (!on) this.stop(); }
  setMuted(m: boolean) { this.muted = !!m; if (m) this.stop(); }
  onSpeakStart(cb: (turnId?: number | null) => void) { this._onSpeakStart.add(cb); return () => this._onSpeakStart.delete(cb); }
  onSpeakEnd(cb: (turnId?: number | null) => void)   { this._onSpeakEnd.add(cb);   return () => this._onSpeakEnd.delete(cb); }
  onStateChange(cb: () => void) { this._onStateChange.add(cb); return () => this._onStateChange.delete(cb); }
  isSpeaking() { return !!this.activeHandle && !this.paused; }
  isPaused()   { return !!this.activeHandle && this.paused; }
  isLoading()  { return !!this.loading; }
  loadingFor() { return this.loading ? this.loadingTurnId : null; }
  reportError(msg: string) {
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
  async speak(text: string, { turnId }: { turnId?: number | null } = {}) {
    if (!this.enabled || this.muted) return;
    if (!text || !text.trim()) return;
    this.stop();
    const meta = TTS_PROVIDER_META[this.providerId];
    if (!meta) return;
    if (!this.adapter) {
      const AdapterClass = await meta.adapterLoader();
      this.adapter = new AdapterClass({ voiceId: this.voiceId, rate: this.rate, key: this.key, model: this.model || meta.model, region: this.region });
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
      const caught = e as ThrownError;
      if (caught?.name === "AbortError") { this._notifyState(); return; }
      const msg = caught?.message || String(e);
      const detail = caught?.detail ? ` — ${caught.detail}` : "";
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
  _startSpeak(t?: number | null) { this._onSpeakStart.forEach((cb) => { try { cb(t); } catch (_) {} }); }
  _endSpeak(t?: number | null)   {
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
