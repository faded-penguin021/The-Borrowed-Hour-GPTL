import { BorrowedError } from "../../llm/errors.js";
import { _fetchAudioBlob, _blobHandle } from "../shared.js";

// ── Voxtral (Mistral TTS) adapter ───────────────────────────────────────
// Uses Mistral's OpenAI-compatible /v1/audio/speech endpoint with model
// voxtral-mini-tts-2603. Body uses voice_id (NOT voice), distinguishing
// it from OpenAI's schema. The hosted API's voice IDs are not the same as
// the open-weight model's preset names — fetch them from /v1/audio/voices.
export async function fetchVoxtralVoices(key, signal) {
  if (!key) return [];
  const resp = await fetch("https://api.mistral.ai/v1/audio/voices?limit=200&offset=0", {
    method: "GET",
    headers: { "Authorization": `Bearer ${key}` },
    signal
  });
  if (!resp.ok) {
    let detail = "";
    try { const txt = await resp.text(); detail = txt.slice(0, 200); } catch (_) {}
    throw new BorrowedError(`Voxtral voice list failed (HTTP ${resp.status})`, detail);
  }
  const data = await resp.json().catch(() => null);
  const items = data?.items || data?.data || [];
  return items.map((v) => ({ id: v.id, label: v.name ? `${v.name} — ${v.id}` : v.id }));
}

export class VoxtralTTSAdapter {
  constructor({ voiceId, rate, key, model }) {
    this.voiceId = voiceId || "en_paul_neutral";
    this.rate = rate || 1.0;
    this.key = key || "";
    this.model = model || "voxtral-mini-tts-2603";
  }
  async synthesize(text, signal, onError) {
    // Mistral's /v1/audio/speech does NOT return raw audio bytes like OpenAI.
    // It returns JSON: { "audio": "<base64>" } (sometimes "audio_data"). Fetch,
    // parse, decode, then build a blob whose magic bytes _blobHandle can sniff.
    const resp = await fetch("https://api.mistral.ai/v1/audio/speech", {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, voice_id: this.voiceId, input: text.trim(), response_format: "mp3" }),
      signal
    });
    if (!resp.ok) {
      let detail = "";
      try { const txt = await resp.text(); detail = txt.slice(0, 200); } catch (_) {}
      throw new BorrowedError(`TTS request failed (HTTP ${resp.status})`, detail);
    }
    const ct = resp.headers.get("content-type") || "";
    let bytes;
    if (ct.includes("application/json")) {
      const data = await resp.json();
      const b64 = data?.audio || data?.audio_data || data?.audio_base64 || data?.data;
      if (typeof b64 !== "string") {
        throw new BorrowedError("Voxtral returned JSON with no audio field", JSON.stringify(data).slice(0, 200));
      }
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new Uint8Array(await resp.arrayBuffer());
    }
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    return _blobHandle(blob, signal, onError);
  }
  destroy() {}
}
