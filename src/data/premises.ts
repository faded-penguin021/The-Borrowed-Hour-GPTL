import type { Premise } from "../types";
import { gmNote as echoTrainGmNote } from "../prompts/premises/echo-train.js";
import { gmNote as neonSpireGmNote } from "../prompts/premises/neon-spire.js";
import { gmNote as omenSolsticeGmNote } from "../prompts/premises/omen-solstice.js";
import { gmNote as dreamCircusGmNote } from "../prompts/premises/dream-circus.js";
import { gmNote as customGmNote } from "../prompts/premises/custom.js";

export function realmGlyph(realm: string): string {
  switch (realm) {
    case "echo":
      return "◷";
    case "neon":
      return "◈";
    case "omen":
      return "✦";
    case "dream":
      return "❋";
    case "wild":
      return "✷";
    default:
      return "·";
  }
}

export const buildCustomPremise = (description: string): Premise => ({
  id: "custom-" + Date.now().toString(36),
  realm: "wild",
  realmLabel: "WILD",
  title: "The Unwritten Hour",
  teaser: description.slice(0, 140) + (description.length > 140 ? "…" : ""),
  isCustom: true,
  seed: description.trim(),
  gmNote: customGmNote
});

export const PREMISES: Premise[] = [
  {
    id: "echo-train",
    realm: "echo",
    realmLabel: "ECHO",
    title: "The 8:11",
    teaser: "A commuter train, a Tuesday morning, and a folded note in your own handwriting you don't remember writing.",
    seed: `The player sits aboard the 8:11 commuter train into the city. It is Tuesday, October 22nd. They are heading toward an appointment whose precise nature they cannot quite hold in their mind, only that it matters and that they are nearly late. The carriage hums. Across the aisle, a woman in a green coat laughs at her phone — the laugh resolves, oddly, into a phrasing the player is certain they have heard before, recently, perhaps yesterday. A newspaper folded on the seat opposite shows the correct date and a headline they could almost recite from memory. In the player's coat pocket: a pen they do not recognize, a single train ticket already punched at this morning's gate, a small bruise on the back of their right hand they cannot account for, and a folded slip of paper in their own handwriting that reads only: NOT HOLBORN. The next stop is Holborn. The conductor's voice over the intercom sounds, briefly, like someone they used to know. Outside the window, the morning light is the wrong color, but only for a moment.`,
    gmNote: echoTrainGmNote
  },
  {
    id: "neon-spire",
    realm: "neon",
    realmLabel: "NEON",
    title: "The Vermillion Thread",
    teaser: "Twenty minutes in an elevator going somewhere you've never been allowed. The Thread is deciding what to do with you.",
    seed: `The player is a runner for the Vermillion Thread, the largest syndicate in the arcology of New Solace. Tonight they have been summoned to the 184th floor of the Spire — twelve floors above any they have been permitted before. The summons arrived as a chrome-trimmed card delivered by a courier whose face was a mirror: 23:00. NO LATE ARRIVALS. NO COMPANIONS. It is now 22:42. The player is in the Spire's express elevator, ascending. The numbers tick. They carry: a monomolecular blade in their boot, Thread-issue, registered to their name; a deck of throwaway shard-credits worth perhaps a month's rent; a neural co-processor recently installed, still settling, the integration headache lingering behind their right eye; a coded ping from their handler Sorrel reading only THEY ARE DECIDING. PLAY GENTLE. Outside the elevator's glass wall, New Solace is wet neon all the way down — towers in the rain, advertising drones in slow loops, the smog tasting of citrus and old copper. The elevator slows. Floor 162. The doors do not open. The player is not alone in the carriage; a man in a charcoal suit, who was not there a moment ago, is reading the floor numbers as they pass.`,
    gmNote: neonSpireGmNote
  },
  {
    id: "omen-solstice",
    realm: "omen",
    realmLabel: "OMEN",
    title: "Three Nights to the Solstice",
    teaser: "You saw the queen die. You cannot tell anyone. Three nights remain, and the assassin already moves among us.",
    seed: `The player is a young oracle at the Temple of the Hollow Sun — recently come into their gift, not yet trusted by their elders. Last night, in the equinox rite, they had a vision of the kind they had been warned would one day come: clear, irrevocable, sent. They saw the High Solar — the empress of the realm — cut down at the Solstice Feast in three nights, by a blade they could not see clearly, held by a hand wearing a copper ring shaped like a coiled serpent. After the killing, the kingdom burned. The vision ended on the smell of pine smoke and the sound of bells.

The player cannot share what they saw openly. Oracles who name the deaths of monarchs are tried as conspirators; the player's predecessor in this temple was hanged for less. They have three days until the Feast. The court will be in residence. The empress is one stranger among thousands. The player wears an apprentice's robe — grey, unadorned — that grants them the temple's freedoms but no access to the court. They have an estranged aunt, a minor noble in the city, who could be reached if the player chose. Other small possessions and entanglements exist for the GM to introduce as the story warrants. The player has begun to feel that someone is watching the temple's gates more closely than yesterday.`,
    gmNote: omenSolsticeGmNote
  },
  {
    id: "dream-circus",
    realm: "dream",
    realmLabel: "DREAM",
    title: "The Carnival Lethe",
    teaser: "A circus that performs in the dreams of sleepers. Tonight the dreamer is dying, the ringmaster is missing, and the big top has begun to leak.",
    seed: `The player is an aerialist in the Carnival Lethe — a circus that does not travel between cities but between sleepers, performing each night in the dream of a single mortal mind. Tonight's audience is one woman, Mara, eighty-one years old, asleep in a hospice bed in a city the player will never see. Tonight's show is going wrong.

The big top is half empty: Mara's dream is thinning. The ringmaster, Iarno, has not appeared for the opening — this has never happened. The lions are pacing in their cage. Sawdust drifts across the ring with the texture of falling ash. A child's bicycle, painted robin's-egg blue, has appeared in the third row of the bleachers — it does not belong to the carnival; it is one of Mara's own memories, leaking through. The player carries: their performer's mask, bone-white and unadorned, which lets them speak in the dreamer's tongue; a wax-sealed letter from Iarno marked DO NOT OPEN UNTIL THE LAST CITY; a half-eaten apple from a market that does not exist; a lucky coin pressed by a saint of nowhere; and a deepening certainty — they do not know how they know — that if they cannot find Mara herself somewhere in this dream and bring her back to the ring, neither of them will be leaving it.`,
    gmNote: dreamCircusGmNote
  }
];

export const NARRATION_LOADING_PHRASES: string[] = [
  "the GM turns the gears",
  "the narrator takes the stage",
  "the hour considers",
  "the world arranges itself",
  "the page turns",
  "the next moment composes itself",
  "the chronicle gathers its breath",
  "the dust settles, then disturbs",
  "the next scene assembles in the dark",
  "the ink finds its course",
  "the hour weighs what comes next",
  "something is being decided about you"
];

export const META_LOADING_PHRASES: string[] = [
  "the author considers",
  "the author gathers their thoughts",
  "the author thinks back on it",
  "the page is consulted",
  "the margins are read again"
];

export const OPENING_LOADING_PHRASES: string[] = [
  "the hour begins to write itself",
  "the first page finds its words",
  "the world steadies into place",
  "the opening is being composed",
  "the chronicle wakes"
];

export const pickPhrase = (pool: string[]): string => pool[Math.floor(Math.random() * pool.length)];
