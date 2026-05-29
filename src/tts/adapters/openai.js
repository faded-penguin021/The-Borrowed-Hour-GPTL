// @ts-check
import { BorrowedError } from "../../llm/errors.js";
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

export class OpenAITTSAdapter {
  /** @param {TTSAdapterOptions} opts */
  constructor({ voiceId, rate, key, model }) {
    this.voiceId = voiceId || "alloy";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "gpt-4o-mini-tts";
  }
  /** @param {string} text @param {AbortSignal} [signal] @param {(msg: string) => void} [onError] @returns {Promise<TTSHandle>} */
  async synthesize(text, signal, onError) {
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
