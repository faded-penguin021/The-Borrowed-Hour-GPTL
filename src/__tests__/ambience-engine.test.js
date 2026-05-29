import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AMBIENCE_SPACE_VALUES,
  AMBIENCE_POPULATION_VALUES,
  AMBIENCE_MOOD_VALUES,
  AMBIENCE_PALETTE_VALUES
} from "../ambience/enums.js";

// ── Minimal Web Audio mock ───────────────────────────────────────────────
// Just enough surface for AmbienceEngine to run its control logic and fire
// every voice without a real audio device. Methods record nothing; they only
// need to exist and not throw.
const makeParam = () => ({
  value: 0,
  setValueAtTime() { return this; },
  linearRampToValueAtTime() { return this; },
  exponentialRampToValueAtTime() { return this; },
  setTargetAtTime() { return this; },
  cancelScheduledValues() { return this; }
});
const audioNode = (extra = {}) => ({
  connect() { return this; },
  disconnect() { return this; },
  ...extra
});
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = "running";
    this.destination = audioNode();
  }
  createGain() { return audioNode({ gain: makeParam() }); }
  createBiquadFilter() { return audioNode({ type: "lowpass", frequency: makeParam(), Q: makeParam() }); }
  createOscillator() { return audioNode({ type: "sine", frequency: makeParam(), detune: makeParam(), start() {}, stop() {} }); }
  createBufferSource() { return audioNode({ buffer: null, loop: false, start() {}, stop() {} }); }
  createConvolver() { return audioNode({ buffer: null }); }
  createDynamicsCompressor() {
    return audioNode({
      threshold: makeParam(), knee: makeParam(), ratio: makeParam(),
      attack: makeParam(), release: makeParam(), reduction: 0
    });
  }
  createDelay() { return audioNode({ delayTime: makeParam() }); }
  createBuffer(channels, len) {
    const data = new Float32Array(len);
    return { getChannelData: () => data, length: len };
  }
  resume() { this.state = "running"; return Promise.resolve(); }
  suspend() { this.state = "suspended"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

let AmbienceEngine;
beforeEach(async () => {
  vi.useFakeTimers();
  globalThis.window = { AudioContext: MockAudioContext };
  ({ AmbienceEngine } = await import("../ambience/engine.js"));
});
afterEach(() => {
  vi.useRealTimers();
  delete globalThis.window;
});

describe("AmbienceEngine — monotonous procedural bed", () => {
  it("constructs and exposes its lanes", () => {
    const eng = new AmbienceEngine();
    expect(eng.master).toBeTruthy();
    expect(eng.chordPad).toBeTruthy();
    expect(eng.melodyVoice).toBeTruthy();
    expect(eng.pulse).toBeTruthy();
    expect(eng.current).toEqual({ space: null, population: null, mood: null });
    eng.destroy();
  });

  it("applies every space / mood / population combination without throwing", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    for (const space of AMBIENCE_SPACE_VALUES) {
      for (const mood of AMBIENCE_MOOD_VALUES) {
        eng.applyAmbience({ space, mood });
        vi.advanceTimersByTime(1600); // let schedulers tick
      }
    }
    for (const population of AMBIENCE_POPULATION_VALUES) {
      eng.applyAmbience({ population });
      vi.advanceTimersByTime(1600);
    }
    // An emitted palette field is harmless — this engine ignores it.
    eng.applyAmbience({ space: "street", mood: "mysterious", palette: "synth" });
    eng.applyAmbience(null);
    eng.destroy();
  });

  it("fires each voice directly without throwing", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ mood: "tense" });
    eng._firePiano(220, 0.1, 2.5);
    eng._firePluck(330, 0.18);
    eng._firePizz(330);
    eng._fireBow(220, 3);
    eng._fireKick(0.5);
    eng._fireSnare(0.3);
    eng._fireHat(0.2);
    eng.destroy();
    expect(true).toBe(true);
  });

  it("holds and overrides ambience state per field", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ space: "street", mood: "mysterious" });
    expect(eng.current.space).toBe("street");
    expect(eng.current.mood).toBe("mysterious");
    // A later emission overrides per field, holding the rest.
    eng.applyAmbience({ mood: "calm" });
    expect(eng.current.mood).toBe("calm");
    expect(eng.current.space).toBe("street");
    eng.destroy();
  });
});

describe("realm-derived opening ambience", () => {
  it("every realm default uses only valid enum values", async () => {
    const { AMBIENCE_REALM_DEFAULTS, AMBIENCE_REALM_FALLBACK } =
      await import("../ambience/tables.js");
    const spaces = new Set(AMBIENCE_SPACE_VALUES);
    const moods = new Set(AMBIENCE_MOOD_VALUES);
    const palettes = new Set(AMBIENCE_PALETTE_VALUES);
    const populations = new Set(AMBIENCE_POPULATION_VALUES);
    for (const bed of [...Object.values(AMBIENCE_REALM_DEFAULTS), AMBIENCE_REALM_FALLBACK]) {
      expect(spaces.has(bed.space)).toBe(true);
      expect(moods.has(bed.mood)).toBe(true);
      expect(palettes.has(bed.palette)).toBe(true);
      expect(populations.has(bed.population)).toBe(true);
    }
  });

  it("falls back to a default bed for an unknown realm", async () => {
    const { defaultAmbienceForRealm, AMBIENCE_REALM_FALLBACK } =
      await import("../ambience/tables.js");
    expect(defaultAmbienceForRealm("nonexistent-realm")).toEqual(AMBIENCE_REALM_FALLBACK);
    expect(defaultAmbienceForRealm("neon").space).toBe("street");
  });

  it("applying a realm default drives the held engine state", async () => {
    const { defaultAmbienceForRealm } = await import("../ambience/tables.js");
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience(defaultAmbienceForRealm("neon"));
    expect(eng.current.space).toBe("street");
    expect(eng.current.mood).toBe("mysterious");
    // A GM emission layered on top overrides per field, holding the rest.
    eng.applyAmbience({ mood: "calm" });
    expect(eng.current.mood).toBe("calm");
    expect(eng.current.space).toBe("street");
    eng.destroy();
  });
});
