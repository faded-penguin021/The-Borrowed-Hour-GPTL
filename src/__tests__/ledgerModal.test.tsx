// @vitest-environment jsdom
//
// The player-facing half of the continuity rules (G5). What the rules DETECT is
// covered by `continuity.test.ts`; this covers what a player is shown, which is
// a narrower thing on purpose: the notes are silent until asked for, and they
// carry the player voice rather than the authoring one.

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LedgerModal } from "../components/modals/LedgerModal";
import type { ContinuityFinding, PlayerLedger, Premise } from "../types";

const premise: Premise = {
  id: "p1", realm: "gothic", realmLabel: "Gothic", title: "The Abbey",
  teaser: "", seed: "", gmNote: "",
};

const ledger: PlayerLedger = {
  scene: "the cloister", time: "dusk", summary: "She arrived in the rain",
  inventory: [], npcs: [], clues: [],
};

const finding = (over: Partial<ContinuityFinding> = {}): ContinuityFinding => ({
  code: "ruled-out-resurfaced",
  detail: "Ledger row L-001 ruled this out, and this turn added it back.",
  note: "Something added this turn was ruled out earlier in the story.",
  ...over,
});

afterEach(cleanup);

describe("the margin notes", () => {
  it("renders nothing at all when the turn was clean", () => {
    render(<LedgerModal premise={premise} ledger={ledger} findings={[]} onClose={() => {}} />);
    expect(screen.queryByText(/IN THE MARGIN/)).toBeNull();
  });

  it("does not show a note until the player asks for it", () => {
    render(<LedgerModal premise={premise} ledger={ledger} findings={[finding()]} onClose={() => {}} />);
    // The block announces that a note EXISTS; the note itself stays folded,
    // because a finding can point straight at a spoiler.
    expect(screen.getByText(/One note was left in the margin/)).toBeTruthy();
    expect(screen.queryByText(/ruled out earlier in the story/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /One note was left in the margin/ }));
    expect(screen.getByText(/ruled out earlier in the story/)).toBeTruthy();
  });

  it("shows the player voice, never the authoring one", () => {
    render(<LedgerModal premise={premise} ledger={ledger} findings={[finding()]} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /note was left in the margin/ }));
    // `detail` names a story-ledger row id -- a tier the player is never shown.
    expect(document.body.textContent).not.toContain("L-001");
    expect(document.body.textContent).not.toContain("hidden_state");
  });

  it("counts more than one", () => {
    render(<LedgerModal premise={premise} ledger={ledger}
      findings={[finding(), finding({ code: "npc-dropped", note: "Bram was listed here last turn and is not listed now." })]}
      onClose={() => {}} />);
    expect(screen.getByText(/2 notes were left in the margin/)).toBeTruthy();
  });

  it("still offers the notes when the ledger itself is blank", () => {
    const blank: PlayerLedger = { scene: "", time: "", summary: "", inventory: [], npcs: [], clues: [] };
    render(<LedgerModal premise={premise} ledger={blank} findings={[finding()]} onClose={() => {}} />);
    expect(screen.getByText(/The ledger is still blank/)).toBeTruthy();
    expect(screen.getByText(/One note was left in the margin/)).toBeTruthy();
  });
});
