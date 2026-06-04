import { z } from "zod";
import {
  AMBIENCE_SPACE_VALUES,
  AMBIENCE_POPULATION_VALUES,
  AMBIENCE_MOOD_VALUES,
  AMBIENCE_PALETTE_VALUES,
  AMBIENCE_EVENT_VALUES,
} from "../ambience/enums";
import type {
  AmbienceSpace,
  AmbiencePopulation,
  AmbienceMood,
  AmbiencePalette,
  AmbienceEvent,
} from "../types";

// Runtime validation contracts for LLM JSON output. These mirror the
// `GameState` / `GMLogicParseResult` interfaces in `src/types.ts`. Arrays use
// `.default([])` and strings use `.default("")` so a partial response from the
// model resolves to a safe, fully-populated object instead of crashing the app.

/** Single NPC entry. */
export const NpcSchema = z.object({
  name: z.string(),
  note: z.string().default("")
});

/**
 * Internal, flat game-state shape. Missing fields fall back to empty values.
 * The app carries state flat (one object), so this stays flat even though the
 * GM tool now emits a nested `{ ledger, hidden_state }` split — see the
 * preprocess in `GameStateSchema` below, which lifts a nested `ledger` up into
 * these fields before validation.
 */
const FlatGameStateSchema = z.object({
  scene: z.string().default(""),
  time: z.string().default(""),
  inventory: z.array(z.string()).default([]),
  npcs: z.array(NpcSchema).default([]),
  clues: z.array(z.string()).default([]),
  summary: z.string().default(""),
  hidden_state: z.string().default("")
});

/**
 * Full game state. The GM tool emits the player-facing fields inside a separate
 * `ledger` sub-object (structurally split from `hidden_state` so GM-only data
 * cannot leak into the diary). This preprocess flattens that nested shape into
 * the internal flat representation, and also accepts an already-flat object for
 * backward compatibility (legacy payloads, the empty-default case, and any model
 * that ignores the nesting). Missing fields fall back to empty values.
 */
export const GameStateSchema = z.preprocess((val) => {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const v = val as Record<string, unknown>;
    const ledger = v.ledger;
    if (ledger && typeof ledger === "object" && !Array.isArray(ledger)) {
      return { ...(ledger as Record<string, unknown>), hidden_state: v.hidden_state };
    }
  }
  return val;
}, FlatGameStateSchema);

/** The canonical set of ending tags, lower-cased. */
export const ENDING_VALUES = ["good", "bittersweet", "pyrrhic", "ambiguous", "bad"] as const;

/**
 * Ending tag. Anything outside the known set (or absent) collapses to `null`
 * via `.catch`, matching the old `VALID_ENDINGS.has(...)` guard — an invalid
 * value must never fail the whole parse.
 *
 * The `preprocess` step normalizes case and surrounding whitespace BEFORE the
 * enum check, because the model is primed by the tool description (which spells
 * the types in caps: "GOOD", "BAD", …) to emit values like `"BAD"` or `" Bad "`.
 * Without this, a case-sensitive `z.enum` would `.catch(null)` a genuine ending
 * silently, and the chronicle would never close.
 */
export const EndingSchema = z
  .preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.enum(ENDING_VALUES).nullable().optional().catch(null)
  );

/**
 * Ambience input schema matching the AmbienceInput interface in types.ts.
 *
 * The enum members are derived directly from the canonical taxonomy in
 * `ambience/enums.ts` — the same arrays the audio engine and GM tool schemas
 * consume — so this schema can never silently drift out of sync with the set of
 * values the model is actually told it may emit. (Previously these lists were
 * hand-copied here and had fallen behind, missing `tavern`/`underwater`,
 * `spirits`/`rain`, and half the event vocabulary.)
 */
const AmbienceSpaceSchema = z
  .enum(AMBIENCE_SPACE_VALUES as [AmbienceSpace, ...AmbienceSpace[]])
  .nullable().optional().catch(undefined);

const AmbiencePopulationSchema = z
  .enum(AMBIENCE_POPULATION_VALUES as [AmbiencePopulation, ...AmbiencePopulation[]])
  .nullable().optional().catch(undefined);

const AmbienceMoodSchema = z
  .enum(AMBIENCE_MOOD_VALUES as [AmbienceMood, ...AmbienceMood[]])
  .nullable().optional().catch(undefined);

const AmbiencePaletteSchema = z
  .enum(AMBIENCE_PALETTE_VALUES as [AmbiencePalette, ...AmbiencePalette[]])
  .nullable().optional().catch(undefined);

const AmbienceEventSchema = z
  .enum(AMBIENCE_EVENT_VALUES as [AmbienceEvent, ...AmbienceEvent[]]);

export const AmbienceInputSchema = z.object({
  space: AmbienceSpaceSchema,
  population: AmbiencePopulationSchema,
  mood: AmbienceMoodSchema,
  palette: AmbiencePaletteSchema,
  events: z.array(AmbienceEventSchema).optional().default([]).catch([]),
}).nullable().optional();

/**
 * GM logic response: the structured decision the game master emits each turn.
 * `state` is required (a turn without state is malformed and triggers a retry);
 * its inner fields are individually defaulted by `GameStateSchema`.
 */
export const GMLogicResponseSchema = z.object({
  narrator_brief: z.string().min(1),
  state: GameStateSchema,
  ending: EndingSchema,
  ambience: AmbienceInputSchema,
});

/**
 * GM opening/narration response. `state` is optional here (the opening may omit
 * it) and defaults to an empty state object so downstream code never sees null
 * for a present-but-empty payload.
 */
export const GMResponseSchema = z.object({
  narration: z.string().min(1),
  state: GameStateSchema.optional().default(() => GameStateSchema.parse({})),
  ending: EndingSchema,
  ambience: AmbienceInputSchema,
});

// Type exports — keep parity with the `src/types.ts` names so consumers retain
// inferred types without importing the runtime schemas.

export type ParsedGameState = z.infer<typeof GameStateSchema>;
export type ParsedGMLogicResponse = z.infer<typeof GMLogicResponseSchema>;
export type ParsedGMResponse = z.infer<typeof GMResponseSchema>;
