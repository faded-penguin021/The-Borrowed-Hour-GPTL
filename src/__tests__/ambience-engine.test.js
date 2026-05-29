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

describe("AmbienceEngine — palette + acoustics", () => {
  it("constructs and exposes the new lanes and palette default", () => {
    const eng = new AmbienceEngine();
    expect(eng.bell).toBeTruthy();
    expect(eng.brass).toBeTruthy();
    expect(eng.toneFilter).toBeTruthy();
    expect(eng.limiter).toBeTruthy();
    expect(eng.palette).toBe("ensemble");
    eng.destroy();
  });

  it("applies every space / mood / palette combination without throwing", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    for (const palette of AMBIENCE_PALETTE_VALUES) {
      for (const space of AMBIENCE_SPACE_VALUES) {
        for (const mood of AMBIENCE_MOOD_VALUES) {
          eng.applyAmbience({ space, mood, palette });
          vi.advanceTimersByTime(1200); // let schedulers tick
        }
      }
    }
    for (const population of AMBIENCE_POPULATION_VALUES) {
      eng.applyAmbience({ population });
    }
    // null clears mood; explicit null palette reverts to default.
    eng.applyAmbience({ palette: null });
    expect(eng.palette).toBe("ensemble");
    eng.applyAmbience(null);
    eng.destroy();
  });

  it("fires every instrument voice directly under each palette", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ mood: "tense" });
    for (const palette of AMBIENCE_PALETTE_VALUES) {
      eng.applyAmbience({ palette });
      eng._fireMelodyNote();
      eng._fireInstrumentNote();
      eng._fireBell(440, 0.16);
      eng._fireBrass(220, 1.5);
      eng._firePiano(220, 0.1, 2.5);
      eng._firePluck(330, 0.18);
      eng._firePizz(330);
      eng._fireBow(220, 3);
    }
    eng.destroy();
    expect(true).toBe(true);
  });

  it("space changes drive reverb and tone targets", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    const spy = vi.spyOn(eng.toneFilter.frequency, "setTargetAtTime");
    eng.applyAmbience({ space: "cavern" });
    eng.applyAmbience({ space: "vehicle" });
    expect(spy).toHaveBeenCalled();
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
    expect(defaultAmbienceForRealm("neon").palette).toBe("synth");
  });

  it("applying a realm default drives the held engine state", async () => {
    const { defaultAmbienceForRealm } = await import("../ambience/tables.js");
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience(defaultAmbienceForRealm("neon"));
    expect(eng.current.space).toBe("street");
    expect(eng.current.mood).toBe("mysterious");
    expect(eng.current.palette).toBe("synth");
    // A GM emission layered on top overrides per field, holding the rest.
    eng.applyAmbience({ mood: "calm" });
    expect(eng.current.mood).toBe("calm");
    expect(eng.current.space).toBe("street");
    eng.destroy();
  });
});
