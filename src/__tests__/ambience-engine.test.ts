import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AmbienceInput } from "../types";
import {
  AMBIENCE_SPACE_VALUES,
  AMBIENCE_POPULATION_VALUES,
  AMBIENCE_MOOD_VALUES,
  AMBIENCE_PALETTE_VALUES
} from "../ambience/enums";

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
  currentTime: number;
  sampleRate: number;
  state: string;
  destination: ReturnType<typeof audioNode>;
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = "running";
    this.destination = audioNode();
  }
  createGain() { return audioNode({ gain: makeParam() }); }
  createBiquadFilter() { return audioNode({ type: "lowpass", frequency: makeParam(), Q: makeParam(), gain: makeParam() }); }
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
  createStereoPanner() { return audioNode({ pan: makeParam() }); }
  createBuffer(channels: number, len: number) {
    const data = new Float32Array(len);
    return { getChannelData: () => data, length: len };
  }
  resume() { this.state = "running"; return Promise.resolve(); }
  suspend() { this.state = "suspended"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

let AmbienceEngine: typeof import("../ambience/engine").AmbienceEngine;
beforeEach(async () => {
  vi.useFakeTimers();
  // Partial browser-global mock: only AudioContext is needed by the engine.
  globalThis.window = { AudioContext: MockAudioContext } as unknown as Window & typeof globalThis;
  ({ AmbienceEngine } = await import("../ambience/engine"));
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { window?: unknown }).window;
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
    eng.applyAmbience({ palette: null } as unknown as AmbienceInput);
    expect(eng.current.palette).toBe(null);
    eng.destroy();
  });

  it("invalid palette is silently dropped and held value unchanged", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ palette: "synth" });
    eng.applyAmbience({ palette: "banjo" } as unknown as AmbienceInput);
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
    const { AMBIENCE_MASTER_LPF_CAP, AMBIENCE_MASTER_LPF_DEFAULT } = await import("../ambience/tables");
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
    const { AMBIENCE_PALETTE, AMBIENCE_MASTER_LPF_CAP } = await import("../ambience/tables");
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
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r = deriveAmbienceFromSeed("A cyberpunk neon city at night");
    expect(r.palette).toBe("synth");
    expect(r.space).toBe("street");
  });

  it("desert seed → guitar / field", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r = deriveAmbienceFromSeed("A vast desert dune at dawn");
    expect(r.palette).toBe("guitar");
    expect(r.space).toBe("field");
  });

  it("starship seed → synth / void", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r = deriveAmbienceFromSeed("Aboard a starship in deep space");
    expect(r.palette).toBe("synth");
    expect(r.space).toBe("void");
  });

  it("gothic manor seed → strings / chamber", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r = deriveAmbienceFromSeed("In a gothic manor with candlelight");
    expect(r.palette).toBe("strings");
    expect(r.space).toBe("chamber");
  });

  it("forest seed → strings / forest", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r = deriveAmbienceFromSeed("Deep in an ancient forest");
    expect(r.palette).toBe("strings");
    expect(r.space).toBe("forest");
  });

  it("vague seed falls back to neutral intimate/solitary/calm/piano", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r = deriveAmbienceFromSeed("You wake and nothing is familiar");
    expect(r.space).toBe("intimate");
    expect(r.population).toBe("solitary");
    expect(r.mood).toBe("calm");
    expect(r.palette).toBe("piano");
  });

  it("result always uses valid enum values for any seed", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const { AMBIENCE_SPACE_VALUES: sp, AMBIENCE_POPULATION_VALUES: po, AMBIENCE_MOOD_VALUES: mo, AMBIENCE_PALETTE_VALUES: pa } = await import("../ambience/enums");
    const spaces = new Set(sp); const pops = new Set(po); const moods = new Set(mo); const palettes = new Set(pa);
    const seeds = ["cyberpunk alley", "starship", "desert dune", "forest", "temple", "gothic manor", "train journey", "city market", "nothing special here"];
    for (const s of seeds) {
      const r = deriveAmbienceFromSeed(s);
      expect(spaces.has(r.space!), `space invalid for: ${s}`).toBe(true);
      expect(pops.has(r.population!), `population invalid for: ${s}`).toBe(true);
      expect(moods.has(r.mood!), `mood invalid for: ${s}`).toBe(true);
      expect(palettes.has(r.palette!), `palette invalid for: ${s}`).toBe(true);
    }
  });

  it("returns a fresh object each call (not a shared reference)", async () => {
    const { deriveAmbienceFromSeed } = await import("../ambience/tables");
    const r1 = deriveAmbienceFromSeed("cyberpunk");
    const r2 = deriveAmbienceFromSeed("cyberpunk");
    expect(r1).not.toBe(r2);
  });
});

describe("realm-derived opening ambience", () => {
  it("every realm default uses only valid enum values", async () => {
    const { AMBIENCE_REALM_DEFAULTS, AMBIENCE_REALM_FALLBACK } =
      await import("../ambience/tables");
    const spaces = new Set<string>(AMBIENCE_SPACE_VALUES);
    const moods = new Set<string>(AMBIENCE_MOOD_VALUES);
    const palettes = new Set<string>(AMBIENCE_PALETTE_VALUES);
    const populations = new Set<string>(AMBIENCE_POPULATION_VALUES);
    for (const rawBed of [...Object.values(AMBIENCE_REALM_DEFAULTS), AMBIENCE_REALM_FALLBACK]) {
      const bed = rawBed as Required<AmbienceInput>;
      expect(spaces.has(bed.space!)).toBe(true);
      expect(moods.has(bed.mood!)).toBe(true);
      expect(palettes.has(bed.palette!)).toBe(true);
      expect(populations.has(bed.population!)).toBe(true);
    }
  });

  it("falls back to a default bed for an unknown realm", async () => {
    const { defaultAmbienceForRealm, AMBIENCE_REALM_FALLBACK } =
      await import("../ambience/tables");
    expect(defaultAmbienceForRealm("nonexistent-realm")).toEqual(AMBIENCE_REALM_FALLBACK);
    expect(defaultAmbienceForRealm("neon").space).toBe("street");
  });

  it("applying a realm default drives the held engine state", async () => {
    const { defaultAmbienceForRealm } = await import("../ambience/tables");
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

describe("tonal center", () => {
  it("realms map to curated keys and unknown realms stay on A", async () => {
    const { deriveTonalCenter } = await import("../ambience/tables");
    expect(deriveTonalCenter("neon")).toBe(-2);
    expect(deriveTonalCenter("dream")).toBe(3);
    expect(deriveTonalCenter("echo")).toBe(-4);
    expect(deriveTonalCenter("omen")).toBe(1);
    expect(deriveTonalCenter("wild")).toBe(5);
    expect(deriveTonalCenter("nonexistent-realm")).toBe(0);
  });

  it("wild seeds hash deterministically into −5..+6", async () => {
    const { deriveTonalCenter } = await import("../ambience/tables");
    const seeds = [
      "submarine depths", "a neon bazaar", "the last library", "orchard of glass",
      "iron caravan", "monastery of echoes", "tidewater carnival", "clockwork garden"
    ];
    const centers = seeds.map((s) => deriveTonalCenter("wild", s));
    for (const c of centers) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(-5);
      expect(c).toBeLessThanOrEqual(6);
    }
    expect(new Set(centers).size).toBeGreaterThan(1);
    expect(deriveTonalCenter("wild", "submarine depths")).toBe(centers[0]);
  });

  it("setTonalCenter retunes tonicHz and wraps out-of-range values", () => {
    const eng = new AmbienceEngine();
    eng.setTonalCenter(3);
    expect(eng.tonicSemitones).toBe(3);
    expect(eng.tonicHz).toBeCloseTo(110 * Math.pow(2, 3 / 12), 5);
    eng.setTonalCenter(7);
    expect(eng.tonicSemitones).toBe(-5);
    eng.setTonalCenter(-7);
    expect(eng.tonicSemitones).toBe(5);
    eng.setTonalCenter(12);
    expect(eng.tonicSemitones).toBe(0);
    expect(eng.tonicHz).toBe(110);
    eng.destroy();
  });

  it("retuning re-glides the sounding pad without bumping _gen", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ mood: "calm" });
    const genBefore = eng._gen;
    const spy = vi.spyOn(eng.chordPad.voices[0].sine.frequency, "setTargetAtTime");
    eng.setTonalCenter(3);
    expect(eng._gen).toBe(genBefore);
    expect(spy).toHaveBeenCalled();
    // Both calm progressions open on the tonic chord, so voice 0 re-glides
    // to the new tonic itself.
    const lastFreq = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(lastFreq).toBeCloseTo(110 * Math.pow(2, 3 / 12), 3);
    eng.destroy();
  });
});

describe("chord voice-leading", () => {
  const asProg = (t: unknown) => t as Record<string, [number, string][]>;

  it("with no previous voicing, returns root position", async () => {
    const { voiceLeadTriad } = await import("../ambience/engine");
    expect(voiceLeadTriad(null, 0, "maj")).toEqual([0, 4, 7]);
    expect(voiceLeadTriad(null, 9, "min")).toEqual([9, 12, 16]);
  });

  it("moves less than the parallel root-position jump and still covers the chord", async () => {
    const { voiceLeadTriad } = await import("../ambience/engine");
    const prev = [0, 4, 7];
    const led = voiceLeadTriad(prev, 9, "min");
    const movement = led.reduce((sum, o, i) => sum + Math.abs(o - prev[i]), 0);
    expect(movement).toBeLessThan(26); // parallel jump to [9,12,16] moves 26
    const pcs = new Set(led.map((o) => ((o % 12) + 12) % 12));
    expect(pcs).toEqual(new Set([9, 0, 4]));
  });

  it("stays in register and covers every chord across all progressions, chained", async () => {
    const { voiceLeadTriad } = await import("../ambience/engine");
    const { AMBIENCE_MOOD_PROGRESSION, AMBIENCE_MOOD_PROGRESSION_ALT } = await import("../ambience/tables");
    for (const table of [asProg(AMBIENCE_MOOD_PROGRESSION), asProg(AMBIENCE_MOOD_PROGRESSION_ALT)]) {
      for (const [mood, prog] of Object.entries(table)) {
        let voicing: number[] | null = null;
        for (let step = 0; step < prog.length * 3; step++) {
          const [root, quality] = prog[step % prog.length];
          const next: number[] = voiceLeadTriad(voicing, root, quality);
          const third = quality === "min" ? root + 3 : root + 4;
          const want = new Set([root, third, root + 7].map((o) => ((o % 12) + 12) % 12));
          const got = new Set(next.map((o) => ((o % 12) + 12) % 12));
          expect(got, `${mood} step ${step}`).toEqual(want);
          for (let v = 0; v < 3; v++) {
            expect(next[v], `${mood} step ${step} voice ${v}`).toBeGreaterThanOrEqual(-3);
            expect(next[v], `${mood} step ${step} voice ${v}`).toBeLessThanOrEqual(19);
            if (voicing) expect(Math.abs(next[v] - voicing[v]), `${mood} step ${step} voice ${v} leap`).toBeLessThanOrEqual(12);
          }
          voicing = next;
        }
      }
    }
  });

  it("is deterministic", async () => {
    const { voiceLeadTriad } = await import("../ambience/engine");
    const a = voiceLeadTriad([0, 4, 7], 5, "maj");
    const b = voiceLeadTriad([0, 4, 7], 5, "maj");
    expect(a).toEqual(b);
  });
});

describe("space reverb profile", () => {
  it("every space has a profile within the master guard bounds", async () => {
    const { AMBIENCE_SPACE_REVERB, AMBIENCE_REVERB_DEFAULT, AMBIENCE_MASTER_LPF_CAP } =
      await import("../ambience/tables");
    const profiles = { ...AMBIENCE_SPACE_REVERB, _default: AMBIENCE_REVERB_DEFAULT };
    for (const space of AMBIENCE_SPACE_VALUES) {
      expect(AMBIENCE_SPACE_REVERB[space], `missing profile for ${space}`).toBeTruthy();
    }
    for (const [name, p] of Object.entries(profiles)) {
      expect(p.ret, `${name} ret`).toBeGreaterThan(0);
      expect(p.ret, `${name} ret`).toBeLessThanOrEqual(1);
      expect(p.damp, `${name} damp`).toBeGreaterThanOrEqual(800);
      expect(p.damp, `${name} damp`).toBeLessThanOrEqual(AMBIENCE_MASTER_LPF_CAP);
    }
  });

  it("builds the damped return path at neutral defaults", async () => {
    const { AMBIENCE_REVERB_DEFAULT } = await import("../ambience/tables");
    const eng = new AmbienceEngine();
    expect(eng.reverbLPF.type).toBe("lowpass");
    expect(eng.reverbLPF.frequency.value).toBe(AMBIENCE_REVERB_DEFAULT.damp);
    expect(eng.reverbReturn.gain.value).toBe(AMBIENCE_REVERB_DEFAULT.ret);
    eng.destroy();
  });

  it("glides the bus per space, skips held spaces, resets on total silence", () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    const retSpy = vi.spyOn(eng.reverbReturn.gain, "setTargetAtTime");
    const dampSpy = vi.spyOn(eng.reverbLPF.frequency, "setTargetAtTime");
    eng.applyAmbience({ space: "cavern" });
    expect(retSpy.mock.calls[retSpy.mock.calls.length - 1][0]).toBeCloseTo(0.90, 5);
    expect(dampSpy.mock.calls[dampSpy.mock.calls.length - 1][0]).toBe(2400);
    const held = retSpy.mock.calls.length;
    eng.applyAmbience({ space: "cavern" });
    expect(retSpy.mock.calls.length).toBe(held);
    eng.applyAmbience(null);
    expect(retSpy.mock.calls[retSpy.mock.calls.length - 1][0]).toBeCloseTo(0.55, 5);
    expect(dampSpy.mock.calls[dampSpy.mock.calls.length - 1][0]).toBe(3200);
    eng.destroy();
  });
});

describe("one-shot herd guards", () => {
  it("_fireEvent is a no-op against a suspended context", async () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    await eng.ctx.suspend();
    const oscSpy = vi.spyOn(eng.ctx, "createOscillator");
    eng._fireEvent("bell_toll");
    expect(eng._activeEvents).toBe(0);
    expect(oscSpy).not.toHaveBeenCalled();
    await eng.ctx.resume();
    eng._fireEvent("bell_toll");
    expect(eng._activeEvents).toBe(1);
    expect(oscSpy).toHaveBeenCalled();
    eng.destroy();
  });

  it("spawns no sources while suspended, resumes spawning after resume", async () => {
    const eng = new AmbienceEngine();
    eng.setIntensity("present");
    eng.applyAmbience({ mood: "calm" });
    await eng.ctx.suspend();
    const oscSpy = vi.spyOn(eng.ctx, "createOscillator");
    const bufSpy = vi.spyOn(eng.ctx, "createBufferSource");
    vi.advanceTimersByTime(180000);
    expect(oscSpy).not.toHaveBeenCalled();
    expect(bufSpy).not.toHaveBeenCalled();
    await eng.ctx.resume();
    vi.advanceTimersByTime(60000);
    expect(oscSpy.mock.calls.length).toBeGreaterThan(0);
    eng.destroy();
  });
});

describe("micro-event pools", () => {
  it("every mood has its own pool of valid events", async () => {
    const { AMBIENCE_MICRO_EVENTS } = await import("../ambience/tables");
    const { AMBIENCE_EVENT_VALUES } = await import("../ambience/enums");
    const events = new Set<string>(AMBIENCE_EVENT_VALUES);
    for (const mood of AMBIENCE_MOOD_VALUES) {
      const pool = AMBIENCE_MICRO_EVENTS[mood];
      expect(pool, `missing micro pool for ${mood}`).toBeTruthy();
      expect(pool.length).toBeGreaterThan(0);
      for (const name of pool) {
        expect(events.has(name), `${mood} pool has unknown event ${name}`).toBe(true);
      }
    }
  });
});
