import type { TTSAdapter, TTSAdapterOptions, TTSHandle } from "../../types";
import { BorrowedError } from "../../llm/errors";
import { _blobHandle } from "../shared";

export class GoogleTTSAdapter implements TTSAdapter {
  voiceId: string;
  rate: number;
  key: string;
  constructor({ voiceId, rate, key }: TTSAdapterOptions) {
    this.voiceId = voiceId || "en-US-Neural2-C";
    this.rate = rate || 1.0;
    this.key = key || "";
  }
  async synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle> {
    if (!this.key) throw new BorrowedError("Google TTS key missing", "Enter your Google Cloud TTS API key in Settings → Reading.");
    const languageCode = this.voiceId.split("-").slice(0, 2).join("-") || "en-US";
    const body = {
      input: { text: text.trim() },
      voice: { languageCode, name: this.voiceId },
      audioConfig: { audioEncoding: "MP3", speakingRate: this.rate }
    };
    // Key travels in a header (same scheme as the Gemini adapter), never the
    // URL — request URLs surface in proxy and extension logs where headers
    // don't, and nothing else in this app puts key material in a URL.
    const resp = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.key },
      body: JSON.stringify(body),
      signal
    });
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.text()).slice(0, 200); } catch (_) {}
      throw new BorrowedError(`Google TTS failed (HTTP ${resp.status})`, detail);
    }
    const data = await resp.json().catch(() => null) as { audioContent?: unknown } | null;
    const b64 = data?.audioContent;
    if (typeof b64 !== "string") {
      throw new BorrowedError("Google TTS returned no audio", JSON.stringify(data).slice(0, 200));
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    return _blobHandle(blob, signal, onError);
  }
  destroy() {}
}
