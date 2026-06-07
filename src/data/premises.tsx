import React from "react";
import type { Premise } from "../types";
import { gmNote as echoTrainGmNote } from "../prompts/premises/echo-train";
import { gmNote as neonSpireGmNote } from "../prompts/premises/neon-spire";
import { gmNote as omenSolsticeGmNote } from "../prompts/premises/omen-solstice";
import { gmNote as dreamCircusGmNote } from "../prompts/premises/dream-circus";
import { gmNote as customGmNote } from "../prompts/premises/custom";
import { Clock4, Diamond, Sparkles, Flower2, Asterisk } from "lucide-react";

export function realmGlyph(realm: string): React.ReactNode {
  const props = { size: 14, strokeWidth: 1.5, "aria-hidden": true as const };
  switch (realm) {
    case "echo":
      return <Clock4 {...props} />;
    case "neon":
      return <Diamond {...props} />;
    case "omen":
      return <Sparkles {...props} />;
    case "dream":
      return <Flower2 {...props} />;
    case "wild":
      return <Asterisk {...props} />;
    default:
      return <span>·</span>;
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
    briefing: `The character knows:
- This is their regular morning commute — the 8:11 into the city, a route they take most weekdays.
- They have an appointment today that matters, though the details feel strangely hard to hold onto.
- The woman in the green coat is a familiar face from the commute — they've seen her before, on other mornings.
- They do not recognize the pen in their pocket, cannot account for the bruise, and did not consciously write the note. These are wrong, and the character knows they are wrong.
- Holborn is the next stop — and their own handwriting says NOT HOLBORN.`,
    gmNote: echoTrainGmNote
  },
  {
    id: "neon-spire",
    realm: "neon",
    realmLabel: "NEON",
    title: "The Vermillion Thread",
    teaser: "Twenty minutes in an elevator going somewhere you've never been allowed. The Thread is deciding what to do with you.",
    seed: `The player is a runner for the Vermillion Thread, the largest syndicate in the arcology of New Solace. Tonight they have been summoned to the 184th floor of the Spire — twelve floors above any they have been permitted before. The summons arrived as a chrome-trimmed card delivered by a courier whose face was a mirror: 23:00. NO LATE ARRIVALS. NO COMPANIONS. It is now 22:42. The player is in the Spire's express elevator, ascending. The numbers tick. They carry: a monomolecular blade in their boot, Thread-issue, registered to their name; a deck of throwaway shard-credits worth perhaps a month's rent; a neural co-processor recently installed, still settling, the integration headache lingering behind their right eye; a coded ping from their handler Sorrel reading only THEY ARE DECIDING. PLAY GENTLE. Outside the elevator's glass wall, New Solace is wet neon all the way down — towers in the rain, advertising drones in slow loops, the smog tasting of citrus and old copper. The elevator slows. Floor 162. The doors do not open. The player is not alone in the carriage; a man in a charcoal suit, who was not there a moment ago, is reading the floor numbers as they pass.`,
    briefing: `The character knows:
- They are a runner for the Vermillion Thread — the largest syndicate in New Solace. They have worked this rank for some time; it is not new to them.
- The Thread is structured in four tiers: the Architect (one person, identity closely held — no runner has met them); the Captains (three, each holding a portfolio of the city); the Lieutenants (each Captain has two or three); and the Runners, which is the player's tier.
- The three Captains, known to every runner by name and reputation: Captain Varda holds the Crescent portfolio (extraction, smuggling, moving people and substances through the lower tiers). Captain March holds the Spire portfolio (the Thread's interface with the corporate towers — protection, blackmail, insider cultivation). Captain Render holds the Signal portfolio (information, surveillance, the Loom's quieter uses) and is rarely seen.
- The player's handler is Sorrel. Sorrel reports up through the Crescent line — ultimately to Captain Varda.
- Tonight's summons is for an evaluation — a possible promotion toward Lieutenant. This would lift the player closer to the rooms where the real decisions are made.
- The player has never been permitted above floor 172. The 184th floor is unknown territory.
- Sorrel's ping — THEY ARE DECIDING. PLAY GENTLE. — is genuine concern from someone who knows the stakes.`,
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
    briefing: `The character knows:
- They are an apprentice oracle at the Temple of the Hollow Sun, recently come into their gift. They have lived and trained at the temple for years.
- Their teacher is a senior oracle at the temple — perceptive and watchful. The character knows this person well; they are a daily presence.
- The vision they received last night was clear and unmistakable: the High Solar (the empress) killed at the Solstice Feast, a blade held by a hand wearing a copper serpent ring, the kingdom burning afterward, the smell of pine smoke, the sound of bells.
- The law is absolute: an oracle who names the death of a monarch is tried as a conspirator. The player's predecessor in this very temple was hanged for doing exactly this. The character cannot speak of the vision openly without risking execution.
- The character has an estranged aunt — a minor noble with a house in the city. They have not spoken in some time, but the aunt has access to court circles the character does not. The character knows where the aunt lives.
- The apprentice's grey robe grants freedom within the temple grounds and access to the city, but NO access to the court or the palace.
- The Solstice Feast is in three nights. The court is already in residence. The empress will be one face among thousands at the Feast.
- Someone — the character is not certain who — seems to be watching the temple gates more closely than usual.`,
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
    briefing: `The character knows:
- They are an aerialist — a performer — in the Carnival Lethe. This is their life; they have performed in many dreams before tonight.
- The Carnival Lethe travels between sleeping minds, not between cities. Each night they perform in the dream of a single mortal. This is normal to the character, not strange.
- Tonight's dreamer is Mara, eighty-one years old, asleep in a hospice. The character knows the dreamer is dying — this is understood, not a revelation.
- The carnival company they know: Iarno, the ringmaster (missing — this has never happened before); Pell, a clown who speaks only in questions; Sorin, a fortune-teller whose cards change suit when no one is watching; Ova, the strongman, gentler than he looks, who has known Iarno longest. The lions — there are always lions.
- The mask (bone-white, unadorned) lets them speak in the dreamer's tongue — this is a tool of their trade.
- Iarno's sealed letter reads DO NOT OPEN UNTIL THE LAST CITY. The character does not know what the Last City is, but they know this is the instruction.
- When a dreamer's dream thins and their memories begin leaking through as objects, the dream is failing. The child's bicycle in the bleachers is a symptom the character recognizes: this dream is coming apart.
- The character senses — without knowing the source of the certainty — that they must find Mara somewhere inside her own dream and bring her back, or neither of them will leave.`,
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
