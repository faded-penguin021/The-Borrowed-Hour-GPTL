// @ts-check
import { z } from "zod";

// Runtime validation contracts for LLM JSON output. These mirror the ambient
// `GameState` / `GMLogicParseResult` interfaces in `src/types.d.ts`. Arrays use
// `.default([])` and strings use `.default("")` so a partial response from the
// model resolves to a safe, fully-populated object instead of crashing the app.

/** Single NPC entry. */
export const NpcSchema = z.object({
  name: z.string(),
  note: z.string().default("")
});

/** Full game state object. Missing fields fall back to empty values. */
export const GameStateSchema = z.object({
  scene: z.string().default(""),
  time: z.string().default(""),
  inventory: z.array(z.string()).default([]),
  npcs: z.array(NpcSchema).default([]),
  clues: z.array(z.string()).default([]),
  summary: z.string().default(""),
  hidden_state: z.string().default("")
});

/**
 * Ending tag. Anything outside the known set (or absent) collapses to `null`
 * via `.catch`, matching the old `VALID_ENDINGS.has(...)` guard — an invalid
 * value must never fail the whole parse.
 */
export const EndingSchema = z
  .enum(["good", "bittersweet", "pyrrhic", "ambiguous", "bad"])
  .nullable()
  .optional()
  .catch(null);

/**
 * GM logic response: the structured decision the game master emits each turn.
 * `state` is required (a turn without state is malformed and triggers a retry);
 * its inner fields are individually defaulted by `GameStateSchema`.
 */
export const GMLogicResponseSchema = z.object({
  narrator_brief: z.string().min(1),
  state: GameStateSchema,
  ending: EndingSchema,
  ambience: z.any().nullable().optional()
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
  ambience: z.any().nullable().optional()
});

// JSDoc typedef exports — keep parity with the ambient `src/types.d.ts` names so
// JS consumers retain inferred types without importing the runtime schemas.

/** @typedef {z.infer<typeof GameStateSchema>} ParsedGameState */
/** @typedef {z.infer<typeof GMLogicResponseSchema>} ParsedGMLogicResponse */
/** @typedef {z.infer<typeof GMResponseSchema>} ParsedGMResponse */

export {};
