import { BorrowedError } from "../../llm/errors.js";
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

// ── Voxtral (Mistral TTS) adapter ───────────────────────────────────────
// Uses Mistral's OpenAI-compatible /v1/audio/speech endpoint with model
// voxtral-mini-tts-2603. Body uses voice_id (NOT voice), distinguishing
// it from OpenAI's schema. Supports 20 preset voices + zero-shot cloning.
export class VoxtralTTSAdapter {
  constructor({ voiceId, rate, key, model }) {
    this.voiceId = voiceId || "neutral_female";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "voxtral-mini-tts-2603";
  }
  async synthesize(text, signal) {
    const blob = await _fetchAudioBlob(
      "https://api.mistral.ai/v1/audio/speech",
      { method: "POST", headers: { "Authorization": `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, voice_id: this.voiceId, input: text.trim(), response_format: "mp3" }) },
      signal
    );
    return _blobHandle(blob, signal);
  }
  destroy() {}
}
