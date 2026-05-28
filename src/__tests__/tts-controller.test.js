import { describe, it, expect, vi } from "vitest";
import { TTSController } from "../tts/controller.js";

// Mock TTS_PROVIDER_META so no real adapters or network are needed
vi.mock("../tts/catalogue.js", () => ({
  TTS_PROVIDER_META: {
    mock: {
      id: "mock",
      model: "default-model",
      models: [{ id: "default-model" }, { id: "other-model" }],
      adapterLoader: async () => {
        // return a minimal fake adapter class
        return class MockAdapter {
          constructor(opts) { this.opts = opts; }
          async synthesize() { return { play: () => {}, pause: () => {}, resume: () => {}, stop: () => {}, set onended(cb) {} }; }
          destroy() {}
        };
      }
    }
  }
}));

describe("TTSController", () => {
  it("starts with model null", () => {
    const ctrl = new TTSController();
    expect(ctrl.model).toBeNull();
  });
  it("setModel updates model and clears adapter", () => {
    const ctrl = new TTSController();
    ctrl.adapter = {}; // fake non-null adapter
    ctrl.setModel("my-model");
    expect(ctrl.model).toBe("my-model");
    expect(ctrl.adapter).toBeNull();
  });
  it("setModel with falsy clears model", () => {
    const ctrl = new TTSController();
    ctrl.model = "some-model";
    ctrl.setModel("");
    expect(ctrl.model).toBeNull();
  });
  it("setProvider updates providerId, voiceId, key, model, region", () => {
    const ctrl = new TTSController();
    ctrl.setProvider("mock", { voiceId: "voice1", key: "k1", model: "m1", region: "westus" });
    expect(ctrl.providerId).toBe("mock");
    expect(ctrl.voiceId).toBe("voice1");
    expect(ctrl.key).toBe("k1");
    expect(ctrl.model).toBe("m1");
    expect(ctrl.region).toBe("westus");
  });
  it("setProvider no-ops when nothing changes", () => {
    const ctrl = new TTSController();
    const fakeAdapter = {};
    ctrl.providerId = "mock";
    ctrl.adapter = fakeAdapter;
    ctrl.key = "k1";
    ctrl.voiceId = "v1";
    ctrl.model = "m1";
    ctrl.region = "eastus";
    ctrl.setProvider("mock", { voiceId: "v1", key: "k1", model: "m1", region: "eastus" });
    expect(ctrl.adapter).toBe(fakeAdapter); // adapter NOT cleared since nothing changed
  });
});
