import type { ToolDefinition } from "../types";
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

export const GM_SCRATCHPAD_DESC: string = `Private GM working space — never shown to the player. Four to seven tight sentences total: assess the action, consult the rules, decide consequences, note anything to carry forward. Keep this brisk; verbose scratchpads eat the budget for narration. The scratchpad conditions everything that follows; use it but do not over-write. BEFORE you stop writing this field, do TWO checks in writing.

(1) BOUNDARY CHECK. Name explicitly which facts the narration THIS TURN will actually show or tell the player, versus which facts remain GM-only (clocks, twists, offstage moves, identities not yet voiced aloud, NPC private motives). The state object you write next must respect that line: anything that does not appear in narration this turn — or in some prior turn — does not enter clues, npcs, or summary.

(2) STYLE CHECK. Glance at the narration that will go out this turn AND at your recent turns. Run four sub-audits, each in writing:
- Character introduction: have you introduced people the same way recently? If so, drastically change focus this turn — a micro-action (cleaning a fingernail), a sensory detail (the smell of old copper), an absence (what their face is specifically NOT doing).
- Metaphor stacking: count the figurative constructions (simile, metaphor, personification, synesthesia) in each paragraph of the new narration. More than one in any paragraph? Cut to one. Most paragraphs should have zero.
- Atmospheric padding: is any sentence describing the quality of silence, tension, or air without advancing action or revealing character? Cut it, or replace it with a concrete action.
- Sensory repetition: have the last few turns leaned on the same sensory anchor (the ozone, the scar, the blade weight, the cold)? If so, reach for a different sense this turn.
For each sub-audit, write a one-line verdict — kept / cut / changed — before moving on. Force syntactic variety.

These two checks are the scratchpad's job; do them here, in writing, every turn.`;

export const STATE_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "The complete refreshed state through the end of this turn — never diffs. Carry forward every load-bearing fact.",
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
    },
    hidden_state: {
      type: "string",
      description: "GM-only notes the player must not see. Counters and clocks (e.g. 'Assassin arrives Night 2'); twist setups; secret allegiances; loop counts; offstage events; faction names not yet revealed; the deeper disposition layer for NPCs (what they actually want, the price they would charge for specific revelations, secrets they are protecting, lies they have told the player). CRITICAL: what is here stays here. Do NOT promote items from hidden_state into clues, npcs, summary, or narration on subsequent turns unless the player has, in the intervening turns, actually witnessed or been told them through narration. The player learning something fictionally is what permits public state to record it. Carry forward across turns and update only when something changes. Aim for under 100 words total; this is bookkeeping, not prose. Empty string is fine for stories that don't need it."
    }
  },
  required: ["scene", "time", "inventory", "npcs", "clues", "summary", "hidden_state"]
};

export const AMBIENCE_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "Optional scene audio. Omit any field to hold its previous value. Pass null for space, population, or mood to fade that lane to silence.",
  properties: {
    space:      { type: "string", enum: AMBIENCE_SPACE_VALUES, description: "Acoustic environment — the kind of place the player is in. intimate=small sealed room; chamber=medium room; hall=large interior; cavern=huge resonant interior; street=outdoor hard surfaces; field=outdoor open; forest=outdoor organic; vehicle=confined moving; void=abstract/unreal. Also sets the room reverb and tone of the music." },
    population: { type: "string", enum: AMBIENCE_POPULATION_VALUES, description: "Optional — what fills the space sonically. solitary=only the speaker; sparse_voices=a few voices nearby; crowd=many voices/bustle; machinery=mechanical/industrial; nature=wind/water/birds; ceremony=ritual/procession; creature=non-human animal; wild=untamed elements (storm, fire, surf). Omit for just-the-room." },
    mood:       { type: "string", enum: AMBIENCE_MOOD_VALUES, description: "Optional — emotional weather. Drives the music CONTENT (scale, chords, tempo, beat). Omit for no music at all." },
    palette:    { type: "string", enum: AMBIENCE_PALETTE_VALUES, description: "Optional — the instrument family the music is voiced with; the TIMBRE the mood is played through. Pick from the SETTING, not the emotion (mood already covers emotion). A subtle background-only layer: it tints the existing voices without adding new ones and never raises loudness or brightness. brass and reed are deliberately muted and dark — lowest presence of any palette. strings=orchestral/period; piano=intimate, modern, spare; synth=electronic, neon, sci-fi (warm hum, not harsh beeps); glass=music-box/bells, dream, childlike, uncanny; choir=voices, sacred, devotional, vast; reed=woodwind/folk drone, ancient, pastoral; brass=horns, martial, civic — muted and heavy; guitar=plucked, warm, folk, frontier. Held across turns — set it when the setting's character is established and only change it when the world's texture changes." },
    events:     { type: "array", items: { type: "string", enum: AMBIENCE_EVENT_VALUES }, description: "Optional — up to 2 one-shot diegetic sounds for this turn. Only when the literal sound carries narrative weight." }
  }
};

export const GM_LOGIC_TOOL: ToolDefinition = {
  name: "gm_decide",
  description: "Decide consequences and update state; produce a public-safe narrator brief.",
  input_schema: {
    type: "object",
    properties: {
      gm_scratchpad: { type: "string", description: GM_SCRATCHPAD_DESC },
      narrator_brief: {
        type: "string",
        description: "A compressed brief for the SEPARATE Narrator who writes the player-facing prose this turn — NOT the prose itself. Give the Narrator the beats to render, who speaks and how, the sensory anchors to reach for, the tone, and explicitly what is SHOWN versus WITHHELD this turn. The Narrator never sees your gm_scratchpad or hidden_state, so the brief must be public-safe: it may direct HOW something is revealed, but it must not hand over GM-only knowledge (hidden identities, offstage moves, twist mechanics, clocks, faction names not yet spoken) the player has not earned — anything you put here can reach the prose. Keep it tight: a short paragraph or two of direction."
      },
      state: STATE_SCHEMA,
      ending: {
        type: "string",
        enum: ["good", "bittersweet", "pyrrhic", "ambiguous", "bad"],
        description: "Set only when the chronicle has reached a true ending per the genre-specific guidance. Otherwise omit."
      },
      ambience: AMBIENCE_SCHEMA
    },
    required: ["gm_scratchpad", "narrator_brief", "state"]
  }
};

export const GM_TOOL: ToolDefinition = {
  name: "narrate_and_update_state",
  description: "Narrate the next turn of the chronicle and update the running state in lockstep. Always called once per turn.",
  input_schema: {
    type: "object",
    properties: {
      gm_scratchpad: { type: "string", description: GM_SCRATCHPAD_DESC },
      narration: {
        type: "string",
        description: "The prose the player will read this turn. Second person, present tense, full literary atmosphere. Length per the system prompt's per-turn rules. Plain prose — no markdown."
      },
      state: STATE_SCHEMA,
      ending: {
        type: "string",
        enum: ["good", "bittersweet", "pyrrhic", "ambiguous", "bad"],
        description: "Set only when the chronicle has reached a true ending per the genre-specific guidance. Otherwise omit. The five types are NOT a softer middle — each is a definite commitment. GOOD: the objective is achieved cleanly. BITTERSWEET: achieved at a cost the player will carry. PYRRHIC: achieved in a way that hollowed out the achievement or the achiever. AMBIGUOUS: the resolution genuinely refuses closure (reserve for stories that earned this; do NOT use to dodge a clean ending). BAD: the player dies, fails irrevocably, or severs the way back. If the genre's named ending condition is met, you must commit — set this field. See the system prompt's ENDING THE CHRONICLE section."
      },
      ambience: AMBIENCE_SCHEMA
    },
    required: ["gm_scratchpad", "narration", "state"]
  }
};
