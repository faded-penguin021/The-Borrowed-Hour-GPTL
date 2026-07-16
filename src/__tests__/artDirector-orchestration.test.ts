import { describe, it, expect } from "vitest";
import {
  buildBootstrapSystem,
  buildTurnSystem,
  parseBootstrapResponse,
  parseTurnResponse,
  mergeLedger,
  composeImagePrompt,
  REALM_AESTHETIC_SEEDS,
} from "../llm/artDirector";
import type { Premise, StyleBible } from "../types";

// Orchestration coverage for the Art Director: the two system-prompt builders
// (realm vs custom, realm fallback), the turn-prompt rendering of the locked
// bible + ledger, and the full parse → merge → compose pipeline that turns a raw
// model tool call into a final image prompt. Helpers/caption are covered
// elsewhere; this file exercises how the pieces fit together.

const realmPremise: Premise = {
  id: "p1", realm: "echo", realmLabel: "Echo", title: "The Hour",
  teaser: "t", seed: "A watchmaker's apprentice finds a clock that runs backward.", gmNote: "",
};

describe("buildBootstrapSystem", () => {
  it("builds the realm system prompt from the realm's aesthetic anchors and the seed", () => {
    const sys = buildBootstrapSystem(realmPremise);
    expect(sys).toContain("REALM AESTHETIC ANCHORS");
    expect(sys).toContain(REALM_AESTHETIC_SEEDS.echo.era);
    expect(sys).toContain(realmPremise.seed);
    expect(sys).toContain("seed_codex");
  });

  it("falls back to the wild aesthetic for an unknown realm", () => {
    const sys = buildBootstrapSystem({ ...realmPremise, realm: "no-such-realm" });
    expect(sys).toContain(REALM_AESTHETIC_SEEDS.wild.era);
    // The unknown realm name must not have been used to look up a (missing) seed.
    expect(sys).not.toContain(REALM_AESTHETIC_SEEDS.echo.era);
  });

  it("uses the custom-scenario branch (no fixed realm anchors) for a custom premise", () => {
    const sys = buildBootstrapSystem({ ...realmPremise, isCustom: true });
    expect(sys).toContain("custom scenario");
    expect(sys).toContain(realmPremise.seed);
    expect(sys).not.toContain("REALM AESTHETIC ANCHORS");
  });
});

describe("buildTurnSystem", () => {
  const bible: StyleBible = {
    era: "tin-type era", medium: "wet plate", palette: ["sepia", "bone"],
    composition: "centered tableau", negatives: ["neon", "text"],
  };

  it("renders the locked bible fields and the current ledger", () => {
    const sys = buildTurnSystem(realmPremise, bible, [
      { id: "npc:elias", tags: ["man", "grey coat"] },
    ]);
    expect(sys).toContain("era: tin-type era");
    expect(sys).toContain("palette: sepia, bone");
    expect(sys).toContain("negatives: neon, text");
    expect(sys).toContain("- npc:elias: man, grey coat");
    expect(sys).toContain("curate_plate");
  });

  it("marks an empty ledger and unset bible fields", () => {
    const sys = buildTurnSystem(realmPremise, {} as StyleBible, []);
    expect(sys).toContain("(empty)");
    expect(sys).toContain("era: (unset)");
  });
});

describe("parse robustness feeding the pipeline", () => {
  it("strips code fences and extracts JSON embedded in prose (turn)", () => {
    const raw = "Here is the plate:\n```json\n" +
      JSON.stringify({ warrants_illustration: true, milestone_reason: "reveal", scene_clause: "a lit doorway" }) +
      "\n```\nHope that helps.";
    const turn = parseTurnResponse(raw);
    expect(turn.malformed).toBeUndefined();
    expect(turn.warrants_illustration).toBe(true);
    expect(turn.scene_clause).toBe("a lit doorway");
  });

  it("marks non-JSON turn output as malformed", () => {
    expect(parseTurnResponse("the model refused").malformed).toBe(true);
  });

  it("drops ledger entries missing an id or tags array during bootstrap parse", () => {
    const raw = JSON.stringify({
      style_bible: { era: "e", medium: "m", palette: ["p"], composition: "c", negatives: ["n"] },
      visual_ledger: [
        { id: "npc:ok", tags: ["woman"] },
        { id: "npc:bad" },            // no tags array
        { tags: ["orphan"] },         // no id
        "junk",
      ],
    });
    const boot = parseBootstrapResponse(raw);
    expect(boot.visual_ledger).toEqual([{ id: "npc:ok", tags: ["woman"] }]);
  });
});

describe("end-to-end: parse → merge ledger → compose prompt", () => {
  it("produces an image prompt carrying style, merged subjects, scene, and deduped negatives", () => {
    const bootRaw = JSON.stringify({
      style_bible: { era: "etching era", medium: "ink wash", palette: ["sepia", "umber"], composition: "centered", negatives: ["text", "logo"] },
      visual_ledger: [{ id: "self:protagonist", tags: ["woman", "red scarf"] }],
    });
    const boot = parseBootstrapResponse(bootRaw);
    expect(boot.malformed).toBeUndefined();

    const turnRaw = "```json\n" + JSON.stringify({
      warrants_illustration: true,
      milestone_reason: "first reveal",
      caption: "The woman in red",
      subject_ids: ["self:protagonist", "npc:elias"],
      scene_clause: "a woman in a red scarf stands in lamplight",
      extra_negatives: ["blurry", "text"],
      ledger_updates: [{ id: "npc:elias", tags: ["man", "grey coat"] }],
    }) + "\n```";
    const turn = parseTurnResponse(turnRaw);

    const merged = mergeLedger(boot.visual_ledger!, turn.ledger_updates!);
    expect(merged.map((e) => e.id).sort()).toEqual(["npc:elias", "self:protagonist"]);

    const composed = composeImagePrompt({
      styleBible: boot.style_bible!,
      visualLedger: merged,
      subjectIds: turn.subject_ids,
      sceneClause: turn.scene_clause,
      extraNegatives: turn.extra_negatives,
    });

    expect(composed.prompt).toContain("etching era");
    expect(composed.prompt).toContain("woman, red scarf");   // self:protagonist tags
    expect(composed.prompt).toContain("man, grey coat");     // merged npc:elias tags
    expect(composed.prompt).toContain("a woman in a red scarf stands in lamplight");
    // negatives from the bible and the turn, deduplicated.
    expect(composed.negatives).toContain("text");
    expect(composed.negatives).toContain("blurry");
    expect(composed.negatives.filter((n) => n === "text")).toHaveLength(1);
  });
});
