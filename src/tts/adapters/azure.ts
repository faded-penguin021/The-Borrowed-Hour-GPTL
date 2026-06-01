import type { TTSAdapter, TTSAdapterOptions, TTSHandle } from "../../types";
import { BorrowedError } from "../../llm/errors";
import { _blobHandle } from "../shared";

export class AzureTTSAdapter implements TTSAdapter {
  voiceId: string;
  rate: number;
  key: string;
  region: string;
  constructor({ voiceId, rate, key, region }: TTSAdapterOptions) {
    this.voiceId = voiceId || "en-US-JennyNeural";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.region = region || "eastus";
  }
  async synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle> {
    if (!this.key) throw new BorrowedError("Azure key missing", "Enter your Azure Speech key in Settings → Reading.");
    const rateStr = this.rate === 1.0 ? "+0%" : `${this.rate >= 1 ? "+" : ""}${Math.round((this.rate - 1) * 100)}%`;
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`
      + `<voice name="${this.voiceId}"><prosody rate="${rateStr}">${escapeXml(text.trim())}</prosody></voice></speak>`;
    const resp = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "BorrowedHour/1"
      },
      body: ssml,
      signal
    });
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.text()).slice(0, 200); } catch (_) {}
      throw new BorrowedError(`Azure TTS failed (HTTP ${resp.status})`, detail);
    }
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    return _blobHandle(blob, signal, onError);
  }
  destroy() {}
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
