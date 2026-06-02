import { describe, it, expect } from "vitest";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue";

describe("TTS_PROVIDER_META integrity", () => {
  it("every ordered provider exists in meta", () => {
    for (const id of TTS_PROVIDER_ORDER) {
      expect(TTS_PROVIDER_META[id], `provider ${id} missing`).toBeDefined();
    }
  });
  it("every provider has an adapterLoader function", () => {
    for (const [id, meta] of Object.entries(TTS_PROVIDER_META)) {
      expect(typeof meta.adapterLoader, `${id}.adapterLoader is not a function`).toBe("function");
    }
  });
  it("providers with inline key storage have keyStorage set", () => {
    const inlineKey = ["elevenlabs", "azure", "google"];
    for (const id of inlineKey) {
      const meta = TTS_PROVIDER_META[id];
      expect(meta, `${id} not in meta`).toBeDefined();
      expect(typeof meta.keyStorage, `${id}.keyStorage missing`).toBe("string");
    }
  });
  it("azure has allowCustomVoiceId for custom region-specific voices", () => {
    expect(TTS_PROVIDER_META.azure.allowCustomVoiceId).toBe(true);
  });
  it("google has allowCustomVoiceId", () => {
    expect(TTS_PROVIDER_META.google.allowCustomVoiceId).toBe(true);
  });
});
