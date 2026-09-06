import { describe, it, expect } from "vitest";
import { checkContinuity } from "../context/continuity";
import { CONTINUITY_LEAK_NGRAM_WORDS, CONTINUITY_LEAK_UNSEGMENTED_CHARS, EMPTY_LEDGER, EMPTY_STATE } from "../data/constants";
import { appendLedgerRows } from "../context/storyLedger";
import type { GameState, StoryLedger } from "../types";

const state = (over: Partial<GameState> = {}): GameState => ({ ...EMPTY_STATE, ...over });
const codes = (f: { code: string }[]) => f.map((x) => x.code);

const SECRET = "the abbot poisoned the wine at the harvest supper last autumn";

describe("hidden state reaching the narration", () => {
  it("fires when a run of the private notes appears in the prose", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: SECRET }), EMPTY_LEDGER,
      `She realised the abbot poisoned the wine at the harvest supper last autumn.`);
    expect(codes(f)).toContain("hidden-state-in-narration");
  });

  it("stays quiet when the prose shares only ordinary words", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: SECRET }), EMPTY_LEDGER,
      "The wine was poured. The supper was long, and the abbot said little.");
    expect(codes(f)).not.toContain("hidden-state-in-narration");
  });

  it("does not judge a secret shorter than the window", () => {
    const short = Array.from({ length: CONTINUITY_LEAK_NGRAM_WORDS - 1 }, (_, i) => `w${i}`).join(" ");
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: short }), EMPTY_LEDGER, short);
    expect(codes(f)).not.toContain("hidden-state-in-narration");
  });

  it("is not fooled by punctuation or casing", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: SECRET }), EMPTY_LEDGER,
      "THE ABBOT, poisoned -- the wine; at the HARVEST supper... last autumn!");
    expect(codes(f)).toContain("hidden-state-in-narration");
  });

  it("never quotes the secret back in the finding", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: SECRET }), EMPTY_LEDGER, SECRET);
    // A finding may reach a player-facing surface; one that proves the leak by
    // repeating it is its own leak.
    for (const finding of f) expect(finding.detail.toLowerCase()).not.toContain("abbot poisoned");
  });
});

describe("hidden state copied into player-visible fields", () => {
  it("fires when the private notes are pasted into the summary", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: SECRET, summary: `So far: ${SECRET}.` }),
      EMPTY_LEDGER, "Nothing was said aloud.");
    expect(codes(f)).toContain("hidden-state-in-state");
  });

  it("fires when it reaches an NPC note", () => {
    const f = checkContinuity(EMPTY_STATE,
      state({ hidden_state: SECRET, npcs: [{ name: "Ada", note: SECRET }] }),
      EMPTY_LEDGER, "Nothing was said aloud.");
    expect(codes(f)).toContain("hidden-state-in-state");
  });

  it("stays quiet when the public fields are unrelated", () => {
    const f = checkContinuity(EMPTY_STATE,
      state({ hidden_state: SECRET, summary: "She arrived at the abbey in the rain." }),
      EMPTY_LEDGER, "Rain on the flagstones.");
    expect(f).toHaveLength(0);
  });
});

describe("an NPC vanishing from the cast", () => {
  const ada = { name: "Ada", note: "the archivist" };
  const bram = { name: "Bram", note: "the ferryman" };

  it("fires when a name present last turn is gone", () => {
    const f = checkContinuity(state({ npcs: [ada, bram] }), state({ npcs: [ada] }), EMPTY_LEDGER, "");
    expect(codes(f)).toEqual(["npc-dropped"]);
    expect(f[0].detail).toContain("Bram");
  });

  it("stays quiet when the note changes but the person remains", () => {
    const f = checkContinuity(state({ npcs: [ada] }), state({ npcs: [{ name: "Ada", note: "dead" }] }),
      EMPTY_LEDGER, "");
    expect(f).toHaveLength(0);
  });

  it("ignores casing and spacing in the name", () => {
    const f = checkContinuity(state({ npcs: [ada] }), state({ npcs: [{ name: " ada ", note: "x" }] }),
      EMPTY_LEDGER, "");
    expect(f).toHaveLength(0);
  });

  it("does NOT treat a lost inventory item as drift", () => {
    // Items get spent, dropped and stolen. Only people are expected to persist.
    const f = checkContinuity(state({ inventory: ["a key", "a coin"] }), state({ inventory: ["a key"] }),
      EMPTY_LEDGER, "");
    expect(f).toHaveLength(0);
  });
});

describe("a ruled-out fact coming back", () => {
  const ruledOut = "the ferryman was nowhere near the abbey that night";
  const ledger: StoryLedger = appendLedgerRows(EMPTY_LEDGER, 1, [{ kind: "ruled_out", text: ruledOut }]);

  it("fires when the turn adds it back as a clue", () => {
    const f = checkContinuity(EMPTY_STATE, state({ clues: [ruledOut] }), ledger, "");
    expect(codes(f)).toContain("ruled-out-resurfaced");
    expect(f[0].detail).toContain("L-001");
  });

  it("reports only on the turn that adds it, not on every turn after", () => {
    const standing = state({ clues: [ruledOut] });
    expect(codes(checkContinuity(standing, standing, ledger, ""))).not.toContain("ruled-out-resurfaced");
  });

  it("ignores an established row -- only a closed door counts", () => {
    const open = appendLedgerRows(EMPTY_LEDGER, 1, [{ kind: "established", text: ruledOut }]);
    expect(checkContinuity(EMPTY_STATE, state({ clues: [ruledOut] }), open, "")).toHaveLength(0);
  });
});

describe("the rule set as a whole", () => {
  it("is silent on an ordinary turn", () => {
    const prev = state({ scene: "the cloister", npcs: [{ name: "Ada", note: "the archivist" }], hidden_state: SECRET });
    const next = state({
      scene: "the scriptorium",
      npcs: [{ name: "Ada", note: "the archivist, uneasy" }],
      clues: ["a torn page"],
      hidden_state: SECRET,
    });
    expect(checkContinuity(prev, next, EMPTY_LEDGER, "She followed Ada into the scriptorium.")).toHaveLength(0);
  });

  it("reports every rule that applies, not just the first", () => {
    const prev = state({ npcs: [{ name: "Bram", note: "the ferryman" }] });
    const next = state({ npcs: [], hidden_state: SECRET, summary: SECRET });
    const f = checkContinuity(prev, next, EMPTY_LEDGER, SECRET);
    expect(new Set(codes(f))).toEqual(
      new Set(["hidden-state-in-narration", "hidden-state-in-state", "npc-dropped"]),
    );
  });
});

describe("a script written without spaces between words", () => {
  // ja / zh / ko all ship. A whitespace window can never fire there, so the
  // leak rules would be silently inert for those players.
  const JA_SECRET = "修道院長が去年の収穫祭でワインに毒を入れた";

  it("fires when the private notes appear in the prose", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: JA_SECRET }), EMPTY_LEDGER,
      `彼女は気づいた。${JA_SECRET}。`);
    expect(codes(f)).toContain("hidden-state-in-narration");
  });

  it("stays quiet on unrelated prose in the same script", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: JA_SECRET }), EMPTY_LEDGER,
      "雨が石畳を叩いていた。");
    expect(f).toHaveLength(0);
  });

  it("does not judge a secret shorter than the character window", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: "毒を入れた" }), EMPTY_LEDGER,
      "毒を入れた");
    expect(f).toHaveLength(0);
  });
});

describe("runs that span two fields", () => {
  it("does not fabricate a match across a field boundary", () => {
    // The run exists only in the concatenation, so no field the player reads
    // contains it -- reporting it would name a leak nobody committed.
    const f = checkContinuity(EMPTY_STATE,
      state({ hidden_state: "the abbot poisoned the wine at the harvest", inventory: ["the abbot poisoned"], clues: ["the wine at the harvest"] }),
      EMPTY_LEDGER, "");
    expect(codes(f)).not.toContain("hidden-state-in-state");
  });
});

describe("the two voices a finding carries", () => {
  // `detail` is for `dlog`; `note` is the only half a player may read (G5).
  // Neither may quote the private text, and `note` may not name a tier the
  // player is never shown.
  const ruledOut = "the ferryman was nowhere near the abbey that night";
  const ledger: StoryLedger = appendLedgerRows(EMPTY_LEDGER, 1, [{ kind: "ruled_out", text: ruledOut }]);

  const everyCode = () => checkContinuity(
    state({ npcs: [{ name: "Bram", note: "the ferryman" }] }),
    state({ npcs: [], hidden_state: SECRET, summary: SECRET, clues: [ruledOut] }),
    ledger,
    SECRET,
  );

  it("gives every finding a non-empty player note", () => {
    const f = everyCode();
    expect(new Set(codes(f))).toEqual(new Set([
      "hidden-state-in-narration", "hidden-state-in-state", "npc-dropped", "ruled-out-resurfaced",
    ]));
    for (const finding of f) expect(finding.note.trim().length).toBeGreaterThan(0);
  });

  it("never quotes the private text in either voice", () => {
    for (const finding of everyCode()) {
      expect(finding.note.toLowerCase()).not.toContain("abbot poisoned");
      expect(finding.detail.toLowerCase()).not.toContain("abbot poisoned");
    }
  });

  it("keeps the story-ledger row id out of the player note", () => {
    const f = everyCode().find((x) => x.code === "ruled-out-resurfaced");
    // The id addresses a memory tier the player cannot see; `detail` may cite
    // it because only `dlog` reads that.
    expect(f?.detail).toContain("L-001");
    expect(f?.note).not.toContain("L-001");
  });
});

describe("Korean is a spaced script, not an unsegmented one", () => {
  // `ko` ships, and it was briefly routed to the character window on the
  // assumption that every CJK-adjacent script runs its words together. Korean
  // spaces them, so twelve syllables would be three or four words -- half the
  // bar every other spaced language is held to.
  const KO_SECRET = "수도원장이 지난해 추수 감사절에 포도주에 독을 넣었다";

  it("fires on a full verbatim run, like any other spaced language", () => {
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: KO_SECRET }), EMPTY_LEDGER,
      `그녀는 깨달았다. ${KO_SECRET}.`);
    expect(codes(f)).toContain("hidden-state-in-narration");
  });

  it("holds Korean to the SIX-WORD window, not the character window", () => {
    // Five words: over the 12-character bar, under the six-word one. The
    // character path would report this; the word path must not.
    const fiveWords = "지난해 추수 감사절에 포도주에 독을";
    const f = checkContinuity(EMPTY_STATE, state({ hidden_state: fiveWords }), EMPTY_LEDGER, fiveWords);
    expect(fiveWords.replace(/\s/g, "").length).toBeGreaterThan(CONTINUITY_LEAK_UNSEGMENTED_CHARS);
    expect(f).toHaveLength(0);
  });
});
