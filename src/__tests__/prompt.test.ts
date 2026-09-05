import { describe, it, expect } from "vitest";
import {
  toPlayerLedger,
  formatStateForPrompt,
  serializeStatePublic,
  stripHistoricalUser,
  stripHistoricalAssistant,
} from "../llm/prompt";
import type { GameState, StoryLedger } from "../types";
import { EMPTY_LEDGER } from "../data/constants";

// The prompt serializers are the barrier between GM-private state and everything
// the player (or a saved/exported transcript) can see. hidden_state must never
// cross into a player-facing projection, and the state→text formatting the model
// consumes must be stable. None of this had direct coverage.

const fullState: GameState = {
  scene: "a cold chamber",
  time: "dusk",
  inventory: ["brass key", "torn letter"],
  npcs: [{ name: "Elias", note: "the watchman" }],
  clues: ["the clock is wrong"],
  summary: "You arrived at the manor.",
  hidden_state: "Elias is the murderer.",
};

describe("toPlayerLedger", () => {
  it("projects a state to the player ledger and drops hidden_state", () => {
    const ledger = toPlayerLedger(fullState);
    expect(ledger).toEqual({
      scene: "a cold chamber",
      time: "dusk",
      inventory: ["brass key", "torn letter"],
      npcs: [{ name: "Elias", note: "the watchman" }],
      clues: ["the clock is wrong"],
      summary: "You arrived at the manor.",
    });
    expect("hidden_state" in ledger).toBe(false);
  });

  it("returns safe empties for null/undefined and coerces non-array fields", () => {
    expect(toPlayerLedger(null)).toEqual({ scene: "", time: "", inventory: [], npcs: [], clues: [], summary: "" });
    const junk = { inventory: "not-an-array", npcs: null, clues: undefined } as unknown as GameState;
    const ledger = toPlayerLedger(junk);
    expect(ledger.inventory).toEqual([]);
    expect(ledger.npcs).toEqual([]);
    expect(ledger.clues).toEqual([]);
  });
});

const ledgerWith: StoryLedger = {
  rows: [
    { id: "L-001", turn: 3, kind: "established", text: "The watchman is dead." },
    { id: "L-002", turn: 4, kind: "ruled_out", text: "The east door will never open again." },
  ],
  chronicle: "",
  rolled: 0,
};

describe("formatStateForPrompt", () => {
  it("returns empty blocks for a null state", () => {
    expect(formatStateForPrompt(null)).toEqual({ publicBlock: "", privateBlock: "" });
  });

  it("renders scene/time/inventory/npcs/clues/summary into the public block", () => {
    const { publicBlock } = formatStateForPrompt(fullState);
    expect(publicBlock).toContain("Scene: a cold chamber");
    expect(publicBlock).toContain("Time: dusk");
    expect(publicBlock).toContain("  - brass key");
    expect(publicBlock).toContain("  - Elias: the watchman");
    expect(publicBlock).toContain("  - the clock is wrong");
    expect(publicBlock).toContain("Story so far: You arrived at the manor.");
  });

  it("marks an empty inventory explicitly and omits empty npc/clue sections", () => {
    const { publicBlock } = formatStateForPrompt({
      ...fullState, inventory: [], npcs: [], clues: [],
    });
    expect(publicBlock).toContain("Inventory: (empty)");
    expect(publicBlock).not.toContain("NPCs encountered:");
    expect(publicBlock).not.toContain("Clues / discoveries:");
  });

  it("routes hidden_state into the private block only, never the public one", () => {
    const { publicBlock, privateBlock } = formatStateForPrompt(fullState);
    expect(publicBlock).not.toContain("Elias is the murderer.");
    expect(privateBlock).toContain("Elias is the murderer.");
    expect(privateBlock).toContain("GM-PRIVATE");
  });

  it("leaves the private block empty when there is no hidden_state", () => {
    const { privateBlock } = formatStateForPrompt({ ...fullState, hidden_state: "" });
    expect(privateBlock).toBe("");
  });

  // The permanent tier is only useful if it is the FIRST thing the turn says.
  // Ordering is the assertion: a ledger rendered under the mutable state is a
  // ledger the model reads as a footnote to memory it is about to overwrite.
  it("puts the story-ledger block above the mutable state block", () => {
    const { publicBlock } = formatStateForPrompt(fullState, ledgerWith);
    expect(publicBlock.indexOf("STORY LEDGER")).toBeGreaterThanOrEqual(0);
    expect(publicBlock.indexOf("STORY LEDGER")).toBeLessThan(publicBlock.indexOf("CURRENT GAME STATE"));
    expect(publicBlock).toContain("The watchman is dead");
    expect(publicBlock).toContain("RULED OUT");
  });

  it("renders the state alone when no ledger is passed, and the ledger alone when there is no state", () => {
    expect(formatStateForPrompt(fullState).publicBlock).not.toContain("STORY LEDGER");
    expect(formatStateForPrompt(fullState, EMPTY_LEDGER).publicBlock).not.toContain("STORY LEDGER");
    const { publicBlock } = formatStateForPrompt(null, ledgerWith);
    expect(publicBlock).toContain("STORY LEDGER");
    expect(publicBlock).not.toContain("CURRENT GAME STATE");
  });

  it("keeps the ledger out of the private block", () => {
    const { privateBlock } = formatStateForPrompt(fullState, ledgerWith);
    expect(privateBlock).not.toContain("STORY LEDGER");
  });
});

describe("serializeStatePublic", () => {
  it("emits only the public fields as pretty JSON, without hidden_state", () => {
    const json = serializeStatePublic(fullState);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      scene: "a cold chamber",
      time: "dusk",
      inventory: ["brass key", "torn letter"],
      npcs: [{ name: "Elias", note: "the watchman" }],
      clues: ["the clock is wrong"],
      summary: "You arrived at the manor.",
    });
    expect(json).not.toContain("hidden_state");
    expect(json).not.toContain("murderer");
  });

  it("returns an empty string for null or non-object input", () => {
    expect(serializeStatePublic(null)).toBe("");
    expect(serializeStatePublic("garbage" as unknown as GameState)).toBe("");
  });
});

describe("stripHistoricalUser", () => {
  it("keeps only the player-action body, dropping trailing GM-private notes", () => {
    const content = "[Player action]\nOpen the door\n\n[GM-PRIVATE — notes]\nsecret";
    expect(stripHistoricalUser(content)).toBe("[Player action]\nOpen the door");
  });

  it("returns the content unchanged when there is no player-action marker", () => {
    expect(stripHistoricalUser("just some text")).toBe("just some text");
  });
});

describe("stripHistoricalAssistant", () => {
  it("reduces a full turn JSON to narration + ending only", () => {
    const content = JSON.stringify({ narration: "The door creaks.", ending: "ongoing", state_patch: { secret: 1 } });
    expect(JSON.parse(stripHistoricalAssistant(content))).toEqual({ narration: "The door creaks.", ending: "ongoing" });
  });

  it("defaults a missing ending to 'ongoing'", () => {
    const content = JSON.stringify({ narration: "hi" });
    expect(JSON.parse(stripHistoricalAssistant(content))).toEqual({ narration: "hi", ending: "ongoing" });
  });

  it("returns the original string when it is not valid JSON", () => {
    expect(stripHistoricalAssistant("not json")).toBe("not json");
  });
});
