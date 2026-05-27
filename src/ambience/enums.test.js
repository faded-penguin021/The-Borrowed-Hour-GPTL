import { describe, it, expect } from "vitest";
import {
  AMBIENCE_SPACE_VALUES,
  AMBIENCE_POPULATION_VALUES,
  AMBIENCE_MOOD_VALUES,
  AMBIENCE_EVENT_VALUES
} from "./enums.js";
import {
  AMBIENCE_SPACES,
  AMBIENCE_POPULATIONS,
  AMBIENCE_MOODS,
  AMBIENCE_EVENTS
} from "./tables.js";
import { GM_TOOL, GM_LOGIC_TOOL } from "../llm/tools.js";

// These tests guard against drift between the three places ambience
// vocabulary is consumed: the engine validation Sets, the GM_TOOL schema
// the LLM sees, and the GM_LOGIC_TOOL schema the structured fallback uses.
// All three must reference the same canonical arrays from enums.js.

describe("ambience enums — single source of truth", () => {
  it("tables.js Sets match enums.js arrays", () => {
    expect([...AMBIENCE_SPACES].sort()).toEqual([...AMBIENCE_SPACE_VALUES].sort());
    expect([...AMBIENCE_POPULATIONS].sort()).toEqual([...AMBIENCE_POPULATION_VALUES].sort());
    expect([...AMBIENCE_MOODS].sort()).toEqual([...AMBIENCE_MOOD_VALUES].sort());
    expect([...AMBIENCE_EVENTS].sort()).toEqual([...AMBIENCE_EVENT_VALUES].sort());
  });

  it("GM_TOOL ambience enums reference the canonical arrays by identity", () => {
    const amb = GM_TOOL.input_schema.properties.ambience.properties;
    expect(amb.space.enum).toBe(AMBIENCE_SPACE_VALUES);
    expect(amb.population.enum).toBe(AMBIENCE_POPULATION_VALUES);
    expect(amb.mood.enum).toBe(AMBIENCE_MOOD_VALUES);
    expect(amb.events.items.enum).toBe(AMBIENCE_EVENT_VALUES);
  });

  it("GM_LOGIC_TOOL ambience enums reference the canonical arrays by identity", () => {
    const amb = GM_LOGIC_TOOL.input_schema.properties.ambience.properties;
    expect(amb.space.enum).toBe(AMBIENCE_SPACE_VALUES);
    expect(amb.population.enum).toBe(AMBIENCE_POPULATION_VALUES);
    expect(amb.mood.enum).toBe(AMBIENCE_MOOD_VALUES);
    expect(amb.events.items.enum).toBe(AMBIENCE_EVENT_VALUES);
  });
});
