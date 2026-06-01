import type { TTSAdapter, TTSAdapterOptions, TTSHandle } from "../../types";
import { _fetchAudioBlob, _blobHandle } from "../shared";

export class OpenAITTSAdapter implements TTSAdapter {
  voiceId: string;
  rate: number;
  key: string;
  model: string;
  constructor({ voiceId, rate, key, model }: TTSAdapterOptions) {
    this.voiceId = voiceId || "alloy";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "gpt-4o-mini-tts";
  }
  async synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle> {
    const blob = await _fetchAudioBlob(
      "https://api.openai.com/v1/audio/speech",
      { method: "POST", headers: { "Authorization": `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, voice: this.voiceId, input: text.trim(), response_format: "mp3", speed: Math.max(0.25, Math.min(4.0, this.rate)) }) },
      signal
    );
    return _blobHandle(blob, signal, onError);
  }
  destroy() {}
}
