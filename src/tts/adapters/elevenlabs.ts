import type { TTSAdapter, TTSAdapterOptions, TTSHandle } from "../../types";
import { _fetchAudioBlob, _blobHandle } from "../shared";

export class ElevenLabsTTSAdapter implements TTSAdapter {
  voiceId: string;
  rate: number;
  key: string;
  model: string;
  constructor({ voiceId, rate, key, model }: TTSAdapterOptions) {
    this.voiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "eleven_turbo_v2_5";
  }
  async synthesize(text: string, signal?: AbortSignal, onError?: (msg: string) => void): Promise<TTSHandle> {
    const blob = await _fetchAudioBlob(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`,
      { method: "POST", headers: { "xi-api-key": this.key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), model_id: this.model, voice_settings: { stability: 0.4, similarity_boost: 0.75 } }) },
      signal
    );
    return _blobHandle(blob, signal, onError);
  }
  destroy() {}
}
