// @ts-check
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

export class ElevenLabsTTSAdapter {
  /** @param {TTSAdapterOptions} opts */
  constructor({ voiceId, rate, key, model }) {
    this.voiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "eleven_turbo_v2_5";
  }
  /** @param {string} text @param {AbortSignal} [signal] @param {(msg: string) => void} [onError] @returns {Promise<TTSHandle>} */
  async synthesize(text, signal, onError) {
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
