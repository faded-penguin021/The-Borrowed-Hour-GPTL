import type { Premise, StyleBible, VisualLedgerEntry } from "../types";
import { describe, it, expect } from "vitest";
import {
  ART_DIRECTOR_BOOTSTRAP_TOOL, ART_DIRECTOR_TURN_TOOL,
  buildBootstrapSystem, buildTurnSystem, composeImagePrompt
} from "../llm/artDirector";

// Character-consistency regression coverage: the codex once let a subject drift
// sex between plates (a story "she" drawn as a bearded man) because nothing in
// the ledger pipeline required an apparent-sex/gender anchor. These tests lock
// the anchor into every surface that carries it — the two tool schemas, both
// system prompts, and the composed image prompt.

const premise: Premise = {
  id: "test", realm: "echo", realmLabel: "The Echo", title: "T", teaser: "",
  seed: "Sorath, a woman in grey robes, keeps the cloister.", gmNote: ""
};

const styleBible: StyleBible = {
  era: "19th-century etching", medium: "ink wash",
  palette: ["sepia", "bone"], composition: "centered tableau", negatives: ["modern"]
};

const bootstrapSchema = JSON.stringify(ART_DIRECTOR_BOOTSTRAP_TOOL.input_schema);
const turnSchema = JSON.stringify(ART_DIRECTOR_TURN_TOOL.input_schema);

describe("art director — sex/gender anchor in the tool schemas", () => {
  it("bootstrap ledger tags require the apparent sex/gender first", () => {
    expect(bootstrapSchema).toMatch(/FIRST tag MUST be the apparent sex\/gender/i);
  });

  it("turn ledger_updates tags require the apparent sex/gender first", () => {
    expect(turnSchema).toMatch(/FIRST tag MUST be the apparent sex\/gender/i);
  });
});

describe("art director — sex/gender anchor in the system prompts", () => {
  it("bootstrap prompt instructs leading person tags with apparent sex/gender (realm + custom)", () => {
    expect(buildBootstrapSystem(premise)).toMatch(/sex\/gender/i);
    expect(buildBootstrapSystem({ ...premise, isCustom: true })).toMatch(/sex\/gender/i);
  });

  it("turn prompt keeps a returning subject's sex fixed to the ledger", () => {
    const sys = buildTurnSystem(premise, styleBible, [{ id: "npc:sorath", tags: ["woman"] }]);
    expect(sys).toMatch(/sex\/gender/i);
    expect(sys).toMatch(/same sex/i);
  });
});

describe("composeImagePrompt — sex tag reaches the image prompt", () => {
  it("surfaces a subject's leading sex tag into the prompt", () => {
    const ledger: VisualLedgerEntry[] = [
      { id: "npc:sorath", tags: ["woman", "shaved head", "grey robes"] }
    ];
    const { prompt } = composeImagePrompt({
      styleBible, visualLedger: ledger,
      subjectIds: ["npc:sorath"],
      sceneClause: "a woman at the cloister gate, lantern raised"
    });
    expect(prompt).toContain("sorath: woman");
  });
});
