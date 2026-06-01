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
  // Partial browser-global mock: only AudioContext is needed by the engine.
  globalThis.window = /** @type {any} */ ({ AudioContext: MockAudioContext });
  ({ AmbienceEngine } = await import("../ambience/engine.js"));
});
afterEach(() => {
  vi.useRealTimers();
  delete globalThis.window;
});

describe("AmbienceEngine — procedural bed", () => {
  it("constructs and exposes its lanes", () => {
    const eng = new AmbienceEngine();
    expect(eng.master).toBeTruthy();
    expect(eng.masterLPF).toBeTruthy();
    expect(eng.masterComp).toBeTruthy();
    expect(eng.chordPad).toBeTruthy();
    expect(eng.melodyVoice).toBeTruthy();
    expect(eng.pulse).toBeTruthy();
    expect(eng.current).toEqual({ space: null, population: null, mood: null, palette: null });
    eng.destroy();
  });

  it("applies every space / mood / population / palette combination without throwing", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    for (const space of AMBIENCE_SPACE_VALUES) {
      for (const mood of AMBIENCE_MOOD_VALUES) {
        eng.applyAmbience({ space, mood });
        vi.advanceTimersByTime(1600);
      }
    }
    for (const population of AMBIENCE_POPULATION_VALUES) {
      eng.applyAmbience({ population });
      vi.advanceTimersByTime(1600);
    }
    for (const palette of AMBIENCE_PALETTE_VALUES) {
      eng.applyAmbience({ mood: "calm", palette });
      vi.advanceTimersByTime(1600);
    }
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
    eng._fireTom(0.4);
    eng._fireRim(0.2);
    eng._fireShaker(0.15);
    eng._fireBrush(0.12);
    eng.destroy();
    expect(true).toBe(true);
  });

  it("resume() resumes a suspended context and is a no-op when running", async () => {
    const eng = new AmbienceEngine();
    await eng.ctx.suspend();
    expect(eng.ctx.state).toBe("suspended");
    eng.resume();
    expect(eng.ctx.state).toBe("running");
    eng.resume();
    expect(eng.ctx.state).toBe("running");
    eng.destroy();
    expect(() => eng.resume()).not.toThrow();
  });

  it("holds and overrides ambience state per field", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ space: "street", mood: "mysterious" });
    expect(eng.current.space).toBe("street");
    expect(eng.current.mood).toBe("mysterious");
    eng.applyAmbience({ mood: "calm" });
    expect(eng.current.mood).toBe("calm");
    expect(eng.current.space).toBe("street");
    eng.destroy();
  });
});

describe("palette", () => {
  it("applies and tracks palette", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ space: "street", mood: "mysterious", palette: "synth" });
    expect(eng.current.palette).toBe("synth");
    eng.destroy();
  });

  it("holds palette when only mood is re-emitted", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ palette: "choir" });
    eng.applyAmbience({ mood: "calm" });
    expect(eng.current.palette).toBe("choir");
    eng.destroy();
  });

  it("changes palette on new emission", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ palette: "synth" });
    eng.applyAmbience({ palette: "choir" });
    expect(eng.current.palette).toBe("choir");
    eng.destroy();
  });

  it("palette null resets current.palette to null", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ palette: "synth" });
    eng.applyAmbience({ palette: null });
    expect(eng.current.palette).toBe(null);
    eng.destroy();
  });

  it("invalid palette is silently dropped and held value unchanged", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ palette: "synth" });
    eng.applyAmbience({ palette: "banjo" });
    expect(eng.current.palette).toBe("synth");
    eng.destroy();
  });

  it("total-silence null resets palette state", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ palette: "glass" });
    eng.applyAmbience(null);
    expect(eng.current.palette).toBe(null);
    eng.destroy();
  });

  it("_applyPalette does not bump _gen", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    const genBefore = eng._gen;
    eng._applyPalette("synth");
    expect(eng._gen).toBe(genBefore);
    eng.destroy();
  });
});

describe("master guard bus", () => {
  it("masterLPF is a lowpass filter at construction", () => {
    const eng = new AmbienceEngine();
    expect(eng.masterLPF.type).toBe("lowpass");
    eng.destroy();
  });

  it("masterLPF default frequency ≤ AMBIENCE_MASTER_LPF_CAP", async () => {
    const { AMBIENCE_MASTER_LPF_CAP, AMBIENCE_MASTER_LPF_DEFAULT } = await import("../ambience/tables.js");
    const eng = new AmbienceEngine();
    expect(eng.masterLPF.frequency.value).toBe(AMBIENCE_MASTER_LPF_DEFAULT);
    expect(eng.masterLPF.frequency.value).toBeLessThanOrEqual(AMBIENCE_MASTER_LPF_CAP);
    eng.destroy();
  });

  it("masterComp exists with threshold ≤ -6 dB and ratio ≥ 2", () => {
    const eng = new AmbienceEngine();
    expect(eng.masterComp).toBeTruthy();
    expect(eng.masterComp.threshold.value).toBeLessThanOrEqual(-6);
    expect(eng.masterComp.ratio.value).toBeGreaterThanOrEqual(2);
    eng.destroy();
  });

  it("every palette config has cutoff ≤ AMBIENCE_MASTER_LPF_CAP and weights ≤ 1", async () => {
    const { AMBIENCE_PALETTE, AMBIENCE_MASTER_LPF_CAP } = await import("../ambience/tables.js");
    for (const [, cfg] of Object.entries(AMBIENCE_PALETTE)) {
      expect(cfg.cutoff).toBeLessThanOrEqual(AMBIENCE_MASTER_LPF_CAP);
      for (const w of Object.values(cfg.weights)) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  it("applying every palette does not throw", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ mood: "calm" });
    for (const palette of AMBIENCE_PALETTE_VALUES) {
      expect(() => eng.applyAmbience({ palette })).not.toThrow();
    }
    eng.destroy();
  });
});

describe("Wild seed classifier — deriveAmbienceFromSeed", () => {
  it("cyberpunk seed → synth / street", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r = deriveAmbienceFromSeed("A cyberpunk neon city at night");
    expect(r.palette).toBe("synth");
    expect(r.space).toBe("street");
  });

  it("desert seed → guitar / field", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r = deriveAmbienceFromSeed("A vast desert dune at dawn");
    expect(r.palette).toBe("guitar");
    expect(r.space).toBe("field");
  });

  it("starship seed → synth / void", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r = deriveAmbienceFromSeed("Aboard a starship in deep space");
    expect(r.palette).toBe("synth");
    expect(r.space).toBe("void");
  });

  it("gothic manor seed → strings / chamber", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r = deriveAmbienceFromSeed("In a gothic manor with candlelight");
    expect(r.palette).toBe("strings");
    expect(r.space).toBe("chamber");
  });

  it("forest seed → strings / forest", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r = deriveAmbienceFromSeed("Deep in an ancient forest");
    expect(r.palette).toBe("strings");
    expect(r.space).toBe("forest");
  });

  it("vague seed falls back to neutral intimate/solitary/calm/piano", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r = deriveAmbienceFromSeed("You wake and nothing is familiar");
    expect(r.space).toBe("intimate");
    expect(r.population).toBe("solitary");
    expect(r.mood).toBe("calm");
    expect(r.palette).toBe("piano");
  });

  it("result always uses valid enum values for any seed", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const { AMBIENCE_SPACE_VALUES: sp, AMBIENCE_POPULATION_VALUES: po, AMBIENCE_MOOD_VALUES: mo, AMBIENCE_PALETTE_VALUES: pa } = await import("../ambience/enums.js");
    const spaces = new Set(sp); const pops = new Set(po); const moods = new Set(mo); const palettes = new Set(pa);
    const seeds = ["cyberpunk alley", "starship", "desert dune", "forest", "temple", "gothic manor", "train journey", "city market", "nothing special here"];
    for (const s of seeds) {
      const r = deriveAmbienceFromSeed(s);
      expect(spaces.has(r.space), `space invalid for: ${s}`).toBe(true);
      expect(pops.has(r.population), `population invalid for: ${s}`).toBe(true);
      expect(moods.has(r.mood), `mood invalid for: ${s}`).toBe(true);
      expect(palettes.has(r.palette), `palette invalid for: ${s}`).toBe(true);
    }
  });

  it("returns a fresh object each call (not a shared reference)", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables.js");
    const r1 = deriveAmbienceFromSeed("cyberpunk");
    const r2 = deriveAmbienceFromSeed("cyberpunk");
    expect(r1).not.toBe(r2);
  });
});

describe("realm-derived opening ambience", () => {
  it("every realm default uses only valid enum values", async () => {
    const { AMBIENCE_REALM_DEFAULTS, AMBIENCE_REALM_FALLBACK } =
      await import("../ambience/tables.js");
    const spaces = /** @type {Set<string>} */ (new Set(AMBIENCE_SPACE_VALUES));
    const moods = /** @type {Set<string>} */ (new Set(AMBIENCE_MOOD_VALUES));
    const palettes = /** @type {Set<string>} */ (new Set(AMBIENCE_PALETTE_VALUES));
    const populations = /** @type {Set<string>} */ (new Set(AMBIENCE_POPULATION_VALUES));
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
    expect(eng.current.palette).toBe("synth");
    eng.applyAmbience({ mood: "calm" });
    expect(eng.current.mood).toBe("calm");
    expect(eng.current.space).toBe("street");
    expect(eng.current.palette).toBe("synth");
    eng.destroy();
  });
});
