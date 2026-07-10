import type { ChatMessage, Entry, MetaMessage, Premise, SaveRecord } from "../types";
import { GameStateSchema } from "../llm/schemas";

export const CURRENT_SAVE_VERSION = 1;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const keepAll = <T>(v: unknown, keep: (el: unknown) => el is T): T[] =>
  Array.isArray(v) ? v.filter(keep) : [];

const isEntry = (el: unknown): el is Entry =>
  isObj(el) && (el.type === "narration" || el.type === "action") && typeof el.text === "string";

const isChatMessage = (el: unknown): el is ChatMessage =>
  isObj(el) && (el.role === "user" || el.role === "assistant") && typeof el.content === "string";

const isMetaMessage = (el: unknown): el is MetaMessage =>
  isObj(el) && (el.role === "user" || el.role === "assistant") && typeof el.text === "string";

/** An entry whose illustration is not a usable object is kept, sans illustration. */
function scrubIllustration(e: Entry): Entry {
  const ill = (e as unknown as Record<string, unknown>).illustration;
  if (ill === undefined) return e;
  if (!isObj(ill) || (ill.url !== undefined && typeof ill.url !== "string")) {
    return { ...e, illustration: undefined };
  }
  return e;
}

/**
 * Migrate + normalize a stored save record. Saves are same-origin data, but
 * they outlive the code that wrote them and survive quota-truncated writes,
 * interrupted compression, and anything else that edits storage out from under
 * us. Normalizing the fields the load path dereferences means a damaged record
 * degrades to a clean banner instead of crashing mid-dispatch. `gameState`
 * goes back through `GameStateSchema`, so stored state gets the same clamps
 * and shape guarantees as live GM output.
 */
export function migrateSave(raw: unknown): SaveRecord {
  if (raw == null || typeof raw !== "object") return raw as SaveRecord;
  const rec = raw as Record<string, unknown>;

  const version = typeof rec.schemaVersion === "number" ? rec.schemaVersion : 0;

  const premise = isObj(rec.premise)
    && typeof rec.premise.id === "string"
    && typeof rec.premise.title === "string"
    ? (rec.premise as unknown as Premise)
    : undefined;

  const gameState = isObj(rec.gameState)
    ? GameStateSchema.safeParse(rec.gameState).data ?? null
    : null;

  return {
    ...rec,
    premise,
    entries: keepAll(rec.entries, isEntry).map(scrubIllustration),
    history: keepAll(rec.history, isChatMessage),
    metaMessages: keepAll(rec.metaMessages, isMetaMessage),
    gameState,
    codex: isObj(rec.codex) ? rec.codex : undefined,
    schemaVersion: version < 1 ? 1 : version,
  } as unknown as SaveRecord;
}
