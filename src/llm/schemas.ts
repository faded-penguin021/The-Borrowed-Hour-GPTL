import { z } from "zod";
import { LEDGER_CHRONICLE_CHAR_CAP, LEDGER_MAX_ROWS } from "../data/constants";
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

// Anti-runaway clamps. Compliant providers already cap output via max_tokens,
// but local endpoints (Ollama, LM Studio) and user proxies may ignore it — and
// state persists into saves and is re-sent with every subsequent turn, so one
// oversized field compounds into permanent per-turn cost. Clamp by truncation,
// never by failing the parse: a turn must not be lost to verbosity.
const MAX_LABEL = 1000;   // scene, time, npc name — a sentence or two
const MAX_ITEM = 1000;    // inventory entries, clues, npc notes
const MAX_PROSE = 20_000; // summary, hidden_state, narration, narrator_brief
const MAX_LIST = 50;      // inventory, npcs, clues

const clamped = (max: number) =>
  z.string().transform((s) => (s.length > max ? s.slice(0, max) : s));

const clampedList = <T extends z.ZodType>(item: T) =>
  z.array(item).transform((a) => (a.length > MAX_LIST ? a.slice(0, MAX_LIST) : a));

/** Single NPC entry. */
export const NpcSchema = z.object({
  name: clamped(MAX_LABEL),
  note: clamped(MAX_ITEM).default("")
});

/**
 * Internal, flat game-state shape. Missing fields fall back to empty values.
 * The app carries state flat (one object), so this stays flat even though the
 * GM tool now emits a nested `{ ledger, hidden_state }` split — see the
 * preprocess in `GameStateSchema` below, which lifts a nested `ledger` up into
 * these fields before validation.
 */
const FlatGameStateSchema = z.object({
  scene: clamped(MAX_LABEL).default(""),
  time: clamped(MAX_LABEL).default(""),
  inventory: clampedList(clamped(MAX_ITEM)).default([]),
  npcs: clampedList(NpcSchema).default([]),
  clues: clampedList(clamped(MAX_ITEM)).default([]),
  summary: clamped(MAX_PROSE).default(""),
  hidden_state: clamped(MAX_PROSE).default("")
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

/**
 * A story-ledger row as it comes back off disk or in from the GM.
 *
 * Note the name: the GM tool's `ledger` sub-object is the player-facing DIARY
 * (PlayerLedger). This is the separate permanent-memory tier (StoryLedger), and
 * the two must never share a field name in a payload -- hence `story_ledger`
 * wherever a model can see it.
 */
const LedgerRowSchema = z.object({
  // Every field catches. Without it one malformed row fails the array, which
  // fails the ledger, which drops the whole tier -- including a perfectly good
  // chronicle -- back to empty. A row is repaired or emptied, never fatal.
  id: clamped(MAX_LABEL).catch("").default(""),
  turn: z.number().int().nonnegative().catch(0).default(0),
  kind: z.enum(["established", "ruled_out"]).catch("established").default("established"),
  text: clamped(MAX_ITEM).catch("").default("")
});

/**
 * The permanent-memory tier. Every field defaults, so a save written before the
 * tier existed -- or a truncated one -- degrades to an empty ledger rather than
 * failing the whole record.
 */
export const StoryLedgerSchema = z.object({
  // NOT clampedList: its MAX_LIST is 50 and the engine holds LEDGER_MAX_ROWS
  // (60), so the shared clamp silently deleted the ten NEWEST rows on every
  // load -- deleted, not folded, with `rolled` left untouched so the next
  // append reissued their ids for different facts. This clamp is tied to the
  // engine's own bound and keeps the TAIL, because if it ever fires the recent
  // rows are the ones worth saving.
  rows: z.array(LedgerRowSchema)
    .transform((a) => (a.length > LEDGER_MAX_ROWS ? a.slice(-LEDGER_MAX_ROWS) : a))
    .transform((a) => a.filter((r) => r.text !== ""))
    .default([]),
  // Matches LEDGER_CHRONICLE_CHAR_CAP, which appendLedgerRows enforces as it
  // folds. Equal by construction: a load-time cap tighter than the in-memory
  // one is a ratchet, trimming a little more on every save/load round trip.
  chronicle: clamped(LEDGER_CHRONICLE_CHAR_CAP).catch("").default(""),
  rolled: z.number().int().nonnegative().catch(0).default(0)
});

/** The canonical set of terminal ending tags, lower-cased. */
export const ENDING_VALUES = ["good", "bittersweet", "pyrrhic", "ambiguous", "bad"] as const;

/**
 * Ending tag. "ongoing" is the active-game default (resolves to `null` so the
 * chronicle continues). Terminal types resolve to their string value and close
 * the chronicle. Anything else outside the known set collapses to `null` via
 * `.catch`, matching the old `VALID_ENDINGS.has(...)` guard — an invalid value
 * must never fail the whole parse.
 *
 * The `preprocess` step normalizes case, trims whitespace, and converts
 * "ongoing" to `null` BEFORE the enum check. The model is primed by the tool
 * description to emit values like `"GOOD"` or `"ONGOING"` in various cases.
 */
export const EndingSchema = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const norm = v.trim().toLowerCase();
      return norm === "ongoing" ? null : norm;
    },
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
  narrator_brief: z.string().min(1).transform((s) => (s.length > MAX_PROSE ? s.slice(0, MAX_PROSE) : s)),
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
  narration: z.string().min(1).transform((s) => (s.length > MAX_PROSE ? s.slice(0, MAX_PROSE) : s)),
  state: GameStateSchema.optional().default(() => GameStateSchema.parse({})),
  ending: EndingSchema,
  ambience: AmbienceInputSchema,
});

// Type exports — keep parity with the `src/types.ts` names so consumers retain
// inferred types without importing the runtime schemas.

export type ParsedGameState = z.infer<typeof GameStateSchema>;
export type ParsedGMLogicResponse = z.infer<typeof GMLogicResponseSchema>;
export type ParsedGMResponse = z.infer<typeof GMResponseSchema>;
