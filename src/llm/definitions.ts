import type { ToolDefinition } from "../types";
import { LEDGER_MAX_ROWS_PER_TURN } from "../data/constants";
import {
  AMBIENCE_SPACE_VALUES,
  AMBIENCE_POPULATION_VALUES,
  AMBIENCE_MOOD_VALUES,
  AMBIENCE_PALETTE_VALUES,
  AMBIENCE_EVENT_VALUES
} from "../ambience/enums";

// ── Shared schema fragments ──────────────────────────────────────────────
// Both the combined opener tool (GM_TOOL) and the per-turn GM-logic tool
// (GM_LOGIC_TOOL) update the same game state and may emit the same ambience.
// Sharing these fragments keeps the anti-leakage field guidance identical
// across both — previously GM_LOGIC_TOOL declared `state: { type: "object" }`
// with no field-level discipline at all, which let GM knowledge leak into the
// player's diary (e.g. a `scene` that editorialised which question "mattered").

export const GM_SCRATCHPAD_DESC: string = `Private GM working space — never shown to the player. Four to seven tight sentences total: assess the action, consult the rules, decide consequences, note anything to carry forward. Keep this brisk; verbose scratchpads eat the budget for narration. The scratchpad conditions everything that follows; use it but do not over-write. BEFORE you stop writing this field, do THREE checks in writing.

(1) BOUNDARY CHECK. Split the facts from this turn into two columns: SHOWN (what the narration actually shows or tells the player) and HIDDEN (clocks, twists, offstage moves, identities not yet voiced, NPC private motives). Then draft the clues you will emit — write each one here, in the output language. Verify each: is it something the player observed or was told, or is it a GM inference? If it draws a conclusion the player hasn't reached themselves, rewrite it as the evidence they actually have. The state object must contain only the clues you drafted here.

(2) STYLE CHECK. Glance at the narration that will go out this turn AND at your recent turns. Run four sub-audits, each in writing:
- Character introduction: have you introduced people the same way recently? If so, drastically change focus this turn — a micro-action (cleaning a fingernail), a sensory detail (the smell of old copper), an absence (what their face is specifically NOT doing).
- Metaphor stacking: count the figurative constructions (simile, metaphor, personification, synesthesia) in each paragraph of the new narration. More than one in any paragraph? Cut to one. Most paragraphs should have zero.
- Advancement: does this turn move the story forward? If the player asked a question, does someone answer (even partially, even evasively — but with WORDS, not silence)? If the player took action, does the world respond with consequence, not just atmosphere? A turn where nothing changes — no new information, no NPC dialogue, no shift in situation — is a failed turn. Rewrite it with plot movement before proceeding.
- Sensory repetition: have the last few turns leaned on the same sensory anchor (the ozone, the scar, the blade weight, the cold)? If so, reach for a different sense this turn.
For each sub-audit, write a one-line verdict — kept / cut / changed — before moving on. Force syntactic variety.

(3) ENDING CHECK. State the genre's ending condition from the seed in one sentence. Then assess: has THIS turn's action satisfied it? If you are setting "ongoing", write one concrete sentence explaining what remains unresolved. If you cannot name a specific unresolved condition — if the core objective has been achieved, the threat neutralized, the question answered — you must commit a terminal ending type instead. "Ongoing" is not the default; it is a claim that the central arc is genuinely incomplete.

These three checks are the scratchpad's job; do them here, in writing, every turn.`;

// The player-facing ledger — its own sub-object, structurally separated from
// hidden_state. This object is rendered verbatim to the player as their diary;
// it is NOT the GM's continuity scratch. Everything in it must be derived only
// from what the narration has shown or told the player this turn or in a prior
// turn. GM-only bookkeeping (clocks, twists, offstage moves, unvoiced identities)
// lives in the sibling `hidden_state` field and never enters this object.
const LEDGER_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "THE PLAYER-FACING LEDGER. This object is shown to the player verbatim as their diary between turns — it is the rendered surface, not GM memory. Fill every field ONLY from what the narration has actually shown or told the player. Nothing the player has not earned in narration may appear here; GM-only knowledge belongs in the sibling hidden_state, never in this object. Refresh completely each turn — never diffs — carrying forward every load-bearing fact the player knows.",
  properties: {
    scene: {
      type: "string",
      description: "One sentence stating WHERE and WHEN the player currently is — location, time-of-day standing, and who or what is physically present. This is a place-and-time stamp for the diary, NOT a recap of the turn's events or a verdict on them. Do NOT editorialise about what just happened, how an NPC reacted, or which of the player's actions mattered. 'The woman in the green coat has just reacted to your questions — one casual, one unsettling' is leakage: it tells the player which of their own questions was significant. State the setting plainly instead: 'On the 8:11, moments from Holborn, the woman in the green coat seated opposite.' Where, when, who is present — no judgement, no significance-talk."
    },
    time: { type: "string", description: "Current time marker." },
    inventory: {
      type: "array",
      items: { type: "string" },
      description: "Each item with brief detail. Carry forward everything still in the player's possession. Returning an empty array when the prior turn had items requires fictional justification this turn (the player was stripped, dropped everything, the loop reset gear, etc.) — otherwise carry items forward."
    },
    npcs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          note: {
            type: "string",
            description: "What the player has learned about this NPC through play — disposition shown, status revealed, things said in the player's hearing. Do NOT include private knowledge the player hasn't earned: hidden allegiances not yet exposed, offstage actions the player hasn't witnessed, certainty about a character's role that the player still only suspects. Hedge the language to match what the player actually knows ('seems wary,' 'claims to be X,' 'suspected of Y') rather than asserting facts the player has not been shown. GM-only knowledge belongs in hidden_state."
          }
        },
        required: ["name", "note"]
      },
      description: "People the player has encountered or learned of by name."
    },
    clues: {
      type: "array",
      items: { type: "string" },
      description: "Significant things the player has personally observed, been told, or pieced together — knowledge they have actually earned in the chronicle. Do NOT include facts only the GM knows: faction names not yet spoken in narration, conspirators' offstage moves, future events. If the player has a suspicion, record it as a suspicion ('the lay brother seems to be watching the gate'), not as a confirmed fact ('the lay brother is a conspiracy watcher'). GM-only knowledge belongs in hidden_state."
    },
    summary: {
      type: "string",
      description: "3 to 5 sentence rolling chronicle of what has happened — past tense, written in the player's voice, recording only what they have lived through. This is the only long-term memory once older turns scroll out; every load-bearing fact the player knows must live here. Past tense only: what HAS happened, never what should or must happen next. 'The player must brief Maret on the discoveries' is a to-do list, not a chronicle — write 'After the meeting with Aldenmoor, Maret was waiting in the cloister' instead. Do NOT include game-mechanic vocabulary ('alert level MEDIUM,' 'conspiracy meter at 60%'), faction names the player hasn't been told, offstage events the player hasn't witnessed, or certainty about characters that hasn't been earned in narration. The summary describes what the chronicle has shown, not what the GM is planning. GM-only material belongs in hidden_state."
    }
  },
  required: ["scene", "time", "inventory", "npcs", "clues", "summary"]
};

export const STATE_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "The complete refreshed state through the end of this turn — never diffs. TWO structurally separate sub-objects: `ledger` is the player-facing diary that renders to the player verbatim; `hidden_state` is GM-only bookkeeping the player never sees. Keeping them as distinct objects is deliberate — fill the ledger only from what narration has shown, and keep everything the player has not yet earned in hidden_state.",
  properties: {
    ledger: LEDGER_SCHEMA,
    hidden_state: {
      type: "string",
      description: "GM-only notes the player must not see. Counters and clocks (e.g. 'Assassin arrives Night 2'); twist setups; secret allegiances; loop counts; offstage events; faction names not yet revealed; the deeper disposition layer for NPCs (what they actually want, the price they would charge for specific revelations, secrets they are protecting, lies they have told the player). CRITICAL: what is here stays here. Do NOT promote items from hidden_state into the ledger (clues, npcs, summary) or narration on subsequent turns unless the player has, in the intervening turns, actually witnessed or been told them through narration. The player learning something fictionally is what permits the ledger to record it. Carry forward across turns and update only when something changes. Aim for under 100 words total; this is bookkeeping, not prose. Empty string is fine for stories that don't need it."
    }
  },
  required: ["ledger", "hidden_state"]
};

// The permanent-memory tier's inbox. Note the field name: the `ledger` sub-object
// inside STATE_SCHEMA is the player-facing DIARY, rewritten wholesale every turn.
// This is the other tier -- appended to, never rewritten -- and the two must not
// share a word in one payload, so everything a model can see says `story_ledger`.
export const STORY_LEDGER_APPEND_SCHEMA: Record<string, unknown> = {
  type: "array",
  // The advertised number IS the enforced one. Said twice in prose here and once
  // more in the system prompt, so it is interpolated rather than typed out: a
  // description promising three while the parser accepts six is the prose/guard
  // drift this repo treats as a defect in its own rules.
  maxItems: LEDGER_MAX_ROWS_PER_TURN,
  items: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["established", "ruled_out"],
        description: "established = the story has settled this as true. ruled_out = the story has CLOSED this off (a door that is sealed, a suspect who is cleared, a route that failed). Ruled-out rows are why the tier exists: without them a later turn quietly re-opens what an earlier one shut."
      },
      text: {
        type: "string",
        description: "One settled fact, one sentence, stated plainly and permanently. Write it so it still reads true fifty turns from now: no 'currently', no 'about to', nothing that a later turn will falsify. This row can never be edited or deleted, so do not record anything in motion."
      }
    },
    required: ["kind", "text"]
  },
  description: `OPTIONAL, and usually empty. Zero to ${LEDGER_MAX_ROWS_PER_TURN} rows this turn (one or two is a normal maximum in practice), only for facts that are now PERMANENT: an identity revealed for good, a death, a bargain struck, a door closed for the rest of the story. This is the one memory that survives — the diary above is rewritten every turn and old turns scroll out of your history entirely, but rows here are read back to you verbatim on every future turn and can never be revised. That permanence cuts both ways: a wrong row is wrong forever, so emit nothing you are not sure of. Do NOT restate a row already in the STORY LEDGER block, do NOT log ordinary turn events (a conversation, a move, a mood), and do NOT mirror the diary. Most turns settle nothing permanent — an empty list is the correct answer then.`
};

export const AMBIENCE_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "Optional scene audio. Omit any field to hold its previous value. Pass null for space, population, or mood to fade that lane to silence.",
  properties: {
    space:      { type: "string", enum: AMBIENCE_SPACE_VALUES, description: "Acoustic environment — the kind of place the player is in. intimate=small sealed room; chamber=medium room; hall=large interior; cavern=huge resonant interior; street=outdoor hard surfaces; field=outdoor open; forest=outdoor organic; vehicle=confined moving; void=abstract/unreal; underwater=submerged/muffled/deep; tavern=warm interior with fire and murmur. Also sets the room reverb and tone of the music." },
    population: { type: "string", enum: AMBIENCE_POPULATION_VALUES, description: "Optional — what fills the space sonically. solitary=only the speaker; sparse_voices=a few voices nearby; crowd=many voices/bustle; machinery=mechanical/industrial; nature=wind/water/birds; ceremony=ritual/procession; creature=non-human animal; wild=untamed elements (storm, fire, surf); spirits=ethereal/ghostly presence; rain=rainfall from drizzle to downpour. Omit for just-the-room." },
    mood:       { type: "string", enum: AMBIENCE_MOOD_VALUES, description: "Optional — emotional weather. Drives the music CONTENT (scale, chords, tempo, beat). Omit for no music at all." },
    palette:    { type: "string", enum: AMBIENCE_PALETTE_VALUES, description: "Optional — the instrument family the music is voiced with; the TIMBRE the mood is played through. Pick from the SETTING, not the emotion (mood already covers emotion). A subtle background-only layer: it tints the existing voices without adding new ones and never raises loudness or brightness. brass and reed are deliberately muted and dark — lowest presence of any palette. strings=orchestral/period; piano=intimate, modern, spare; synth=electronic, neon, sci-fi (warm hum, not harsh beeps); glass=music-box/bells, dream, childlike, uncanny; choir=voices, sacred, devotional, vast; reed=woodwind/folk drone, ancient, pastoral; brass=horns, martial, civic — muted and heavy; guitar=plucked, warm, folk, frontier. Held across turns — set it when the setting's character is established and only change it when the world's texture changes." },
    events:     { type: "array", items: { type: "string", enum: AMBIENCE_EVENT_VALUES }, description: "Optional — up to 2 one-shot diegetic sounds for this turn. Only when the literal sound carries narrative weight. Includes: bells, doors, footsteps, wind, thunder, paper, chair, glass, coins, crowd, cough, breath, metal, whisper, rain_patter, fire_crackle, water_drip, heartbeat, keys_jingle, horse_hooves, owl_hoot, sword_draw, book_page_turn, lock_click, crowd_cheer, sigh_close." }
  }
};

// The two GM tool schemas come in ambience-on and ambience-off variants. When
// the user has disabled ambience in settings, the system prompt drops the
// AMBIENCE block, and the tool schema drops the matching field so the model
// isn't advertised a slot it was never briefed on. Variants are pre-built and
// memoised so call sites get stable object identity (the per-turn dispatch in
// gameLoop relies on identity comparisons in tests, and provider caches key off
// the request shape).

function makeGMLogicTool(ambience: boolean): ToolDefinition {
  const properties: Record<string, unknown> = {
    gm_scratchpad: { type: "string", description: GM_SCRATCHPAD_DESC },
    narrator_brief: {
      type: "string",
      description: "A compressed brief for the SEPARATE Narrator who writes the player-facing prose this turn — NOT the prose itself. Give the Narrator the beats to render, who speaks and how, the sensory anchors to reach for, the tone, and explicitly what is SHOWN versus WITHHELD this turn. The Narrator never sees your gm_scratchpad or hidden_state, so the brief must be public-safe: it may direct HOW something is revealed, but it must not hand over GM-only knowledge (hidden identities, offstage moves, twist mechanics, clocks, faction names not yet spoken) the player has not earned — anything you put here can reach the prose. Keep it tight: a short paragraph or two of direction."
    },
    state: STATE_SCHEMA,
    story_ledger_append: STORY_LEDGER_APPEND_SCHEMA,
    ending: {
      type: "string",
      enum: ["ongoing", "good", "bittersweet", "pyrrhic", "ambiguous", "bad"],
      description: "REQUIRED every turn. Set to 'ongoing' while the chronicle is still active and the genre-specific ending condition has NOT been met. Set to one of the five terminal types when the ending condition IS met — this closes the chronicle. See the system prompt's ENDING THE CHRONICLE section."
    }
  };
  if (ambience) properties.ambience = AMBIENCE_SCHEMA;
  return {
    name: "gm_decide",
    description: "Decide consequences and update state; produce a public-safe narrator brief.",
    input_schema: {
      type: "object",
      properties,
      required: ["gm_scratchpad", "narrator_brief", "state", "ending"]
    }
  };
}

function makeGMTool(ambience: boolean): ToolDefinition {
  const properties: Record<string, unknown> = {
    gm_scratchpad: { type: "string", description: GM_SCRATCHPAD_DESC },
    narration: {
      type: "string",
      description: "The prose the player will read this turn. Second person, present tense, full literary atmosphere. Length per the system prompt's per-turn rules. Plain prose — no markdown."
    },
    state: STATE_SCHEMA,
    story_ledger_append: STORY_LEDGER_APPEND_SCHEMA,
    ending: {
      type: "string",
      enum: ["ongoing", "good", "bittersweet", "pyrrhic", "ambiguous", "bad"],
      description: "REQUIRED every turn. Set to 'ongoing' while the chronicle is still active. Set to a terminal type when the genre-specific ending condition IS met — this closes the chronicle. GOOD: objective achieved cleanly. BITTERSWEET: achieved at a cost. PYRRHIC: hollowed out the achievement or the achiever. AMBIGUOUS: genuinely refuses closure (reserve for stories that earned this). BAD: death, irrevocable failure. See the system prompt's ENDING THE CHRONICLE section."
    }
  };
  if (ambience) properties.ambience = AMBIENCE_SCHEMA;
  return {
    name: "narrate_and_update_state",
    description: "Narrate the next turn of the chronicle and update the running state in lockstep. Always called once per turn.",
    input_schema: {
      type: "object",
      properties,
      required: ["gm_scratchpad", "narration", "state", "ending"]
    }
  };
}

const GM_LOGIC_TOOL_WITH_AMBIENCE = makeGMLogicTool(true);
const GM_LOGIC_TOOL_NO_AMBIENCE = makeGMLogicTool(false);
const GM_TOOL_WITH_AMBIENCE = makeGMTool(true);
const GM_TOOL_NO_AMBIENCE = makeGMTool(false);

export function buildGMLogicTool({ ambience = true }: { ambience?: boolean } = {}): ToolDefinition {
  return ambience ? GM_LOGIC_TOOL_WITH_AMBIENCE : GM_LOGIC_TOOL_NO_AMBIENCE;
}

export function buildGMTool({ ambience = true }: { ambience?: boolean } = {}): ToolDefinition {
  return ambience ? GM_TOOL_WITH_AMBIENCE : GM_TOOL_NO_AMBIENCE;
}

export const GM_LOGIC_TOOL: ToolDefinition = GM_LOGIC_TOOL_WITH_AMBIENCE;
export const GM_TOOL: ToolDefinition = GM_TOOL_WITH_AMBIENCE;
