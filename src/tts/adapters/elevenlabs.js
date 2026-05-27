import { BorrowedError } from "../../llm/errors.js";
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

// ── ElevenLabs adapter ───────────────────────────────────────────────────
export class ElevenLabsTTSAdapter {
  constructor({ voiceId, rate, key, model }) {
    this.voiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "eleven_turbo_v2_5";
  }
  async synthesize(text, signal) {
    const blob = await _fetchAudioBlob(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`,
      { method: "POST", headers: { "xi-api-key": this.key, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), model_id: this.model, voice_settings: { stability: 0.4, similarity_boost: 0.75 } }) },
      signal
    );
    return _blobHandle(blob, signal);
  }
  destroy() {}
}
