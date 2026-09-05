import type { AmbienceInput, GMLogicParseResult, GMParseResult, GameState } from "../types";
import { sanitizeAmbience } from "../ambience/tables";
import { GMLogicResponseSchema, GMResponseSchema } from "./schemas";
import { dlog } from "../debug/debugLog";

/**
 * Per-turn breadcrumb for the `ending` field, so the debug console can tell the
 * four cases apart:
 *   - model never committed an ending     → rawPresent:false, resolved:null
 *   - model committed "ongoing"           → rawPresent:true,  resolved:null, ongoing:true
 *   - model committed a valid ending      → rawPresent:true,  resolved:"bad"
 *   - model committed an unrecognized tag → rawPresent:true,  resolved:null  (DROPPED)
 */
function logEnding(rawEnding: unknown, resolved: string | null): void {
  const rawPresent = rawEnding != null;
  const ongoing = typeof rawEnding === "string" && rawEnding.trim().toLowerCase() === "ongoing";
  const dropped = rawPresent && resolved == null && !ongoing;
  dlog("parse: ending", { rawEnding, resolved, rawPresent, ongoing, dropped });
}

export function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

export function tryParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Regex syntax recovery for almost-JSON the model emits: drop trailing commas,
 * normalize smart quotes, and escape raw control characters inside strings.
 * Operates on the JSON *string* (Layer 1) — orthogonal to Zod schema validation
 * (Layer 2), which only runs on an already-parsed object.
 */
export function repairJSON(text: string): string {
  let t = text;
  t = t.replace(/,(\s*[}\]])/g, "$1");
  t = t.replace(/[“”]/g, '"');
  let out = "";
  let inStr = false;
  let escaped = false;
  for (let i = 0;i < t.length; i++) {
    const ch = t[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr) {
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/**
 * Scan from `start` (which must point at an opening `{`) to the matching close
 * brace, ignoring braces inside strings. Returns the index of the closing brace,
 * or -1 if the object never closes. Used to slice off trailing garbage (e.g. a
 * stray extra `}`) before parsing — this is structural extraction, not repair.
 */
export function findBalancedJSONEnd(text: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (inStr) {
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const MAX_REPAIR_LENGTH = 200_000;

/**
 * Slice the first balanced `{...}` object out of `text` (dropping trailing
 * garbage such as a stray extra brace), falling back to a first-`{`-to-last-`}`
 * slice. Returns the parsed object or null.
 */
function extractObject(text: string): unknown {
  const first = text.indexOf("{");
  if (first < 0) return null;
  const end = findBalancedJSONEnd(text, first);
  if (end > first) {
    const parsed = tryParseJSON(text.slice(first, end + 1));
    if (parsed) return parsed;
  }
  const last = text.lastIndexOf("}");
  if (last > first) {
    const parsed = tryParseJSON(text.slice(first, last + 1));
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Some models wrap the tool payload in a one-element array (`[{...}]`).
 * Unwrap to the first plain-object element; a bare array is useless to both
 * GM parsers, which require an object.
 */
function unwrapArray(parsed: unknown): unknown {
  if (!Array.isArray(parsed)) return parsed;
  return parsed.find((el) => el && typeof el === "object" && !Array.isArray(el)) ?? null;
}

/**
 * Multi-stage JSON recovery (Layer 1 — string → object). Strip markdown fences,
 * direct-parse, slice the first balanced object, then run a regex repair pass
 * (trailing commas, smart quotes, raw control chars) and re-extract. Returns the
 * parsed object, or null if nothing JSON-shaped survives. Schema *validation* is
 * a separate concern handled by Zod (Layer 2) on the returned object.
 */
export function extractJSONBlock(rawText: string): unknown {
  let text = (rawText || "").trim();
  text = text.replace(/^\s*[`~]{3}[ \t]*[a-zA-Z]*[ \t]*\r?\n?/, "");
  text = text.replace(/\r?\n?[ \t]*[`~]{3}[ \t]*$/, "");
  text = text.trim();

  let parsed = tryParseJSON(text);
  if (parsed) return unwrapArray(parsed);

  parsed = extractObject(text);
  if (parsed) return parsed;

  if (text.length > MAX_REPAIR_LENGTH) return null;

  const repaired = repairJSON(text);
  parsed = tryParseJSON(repaired);
  if (parsed) return unwrapArray(parsed);

  return extractObject(repaired);
}

export function buildParseDiagnostic(rawText: string, parsed?: unknown, reasonGuess?: string | null): string {
  const raw = rawText || "";
  const len = raw.length;
  const head = raw.slice(0, 200).replace(/\s+/g, " ");
  const tail = raw.slice(-200).replace(/\s+/g, " ");
  const endsCleanly = /[}\]]\s*$/.test(raw);
  const startsAsJson = /^\s*[{[]/.test(raw);
  let reason = reasonGuess;
  if (!reason) {
    if (len === 0) reason = "Raw payload was empty.";
    else if (!parsed) reason = endsCleanly
      ? "JSON parse failed despite a clean ending — likely a structural error inside the payload."
      : "JSON parse failed and the payload does not end cleanly — likely truncated by max_tokens.";
    else if (typeof parsed !== "object") reason = "Parsed value was not an object.";
    else reason = "Parsed object was missing required fields.";
  }
  return `${reason} Length: ${len}. Starts with JSON: ${startsAsJson ? "yes" : "no"}. Ends cleanly: ${endsCleanly ? "yes" : "no"}. Head: «${head}»${len > 400 ? " … " : " "}Tail: «${tail}».`;
}

/**
 * Render Zod validation issues into a compact, field-keyed diagnostic so the
 * corrective prompt tells the model exactly which schema field it violated.
 */
export function formatZodDiagnostic(error: import("zod").ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

// Minimal shape for the raw, untyped LLM payload before schema validation.
interface RawGMObject {
  ambience?: unknown;
  narrator_brief?: unknown;
  narration?: unknown;
  brief?: unknown;
  text?: unknown;
}

/**
 * Resolve the explicit-null / present / absent semantics for ambience the same
 * way the previous parser did, then sanitize any present value.
 */
function resolveAmbience(obj: unknown): AmbienceInput | null | undefined {
  if (!obj || typeof obj !== "object" || !("ambience" in obj)) return undefined;
  const ambience = (obj as RawGMObject).ambience;
  if (ambience === null) return null;
  return sanitizeAmbience(ambience);
}

export function parseGMLogicResponse(rawText: string): GMLogicParseResult {
  const obj = extractJSONBlock(rawText);
  if (!obj || typeof obj !== "object") {
    return { narrator_brief: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, "Malformed GM logic response — could not parse JSON.") };
  }

  // Accept the legacy field aliases for the brief before strict validation.
  const raw = obj as RawGMObject;
  const candidate: Record<string, unknown> = { ...raw };
  if (typeof candidate.narrator_brief !== "string" || !candidate.narrator_brief.trim()) {
    const alt = firstString(raw.narrator_brief, raw.narration, raw.brief, raw.text);
    if (alt) candidate.narrator_brief = alt;
  }

  const result = GMLogicResponseSchema.safeParse(candidate);
  if (!result.success) {
    return { narrator_brief: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, `GM logic response failed schema validation — ${formatZodDiagnostic(result.error)}`) };
  }

  logEnding((obj as RawGMObject & { ending?: unknown }).ending, result.data.ending ?? null);
  return {
    narrator_brief: result.data.narrator_brief,
    state: result.data.state,
    ending: result.data.ending ?? null,
    ambience: resolveAmbience(obj),
    story_ledger_append: result.data.story_ledger_append,
    raw: rawText,
    malformed: false
  };
}

export function parseGMResponse(rawText: string): GMParseResult {
  const obj = extractJSONBlock(rawText);
  if (!obj || typeof obj !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[borrowed] Malformed GM response", { raw: rawText });
    }
    return { narration: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, "Malformed GM response — could not parse JSON.") };
  }

  // Accept the legacy field aliases for the narration before strict validation.
  const raw = obj as RawGMObject;
  const candidate: Record<string, unknown> = { ...raw };
  if (typeof candidate.narration !== "string" || !candidate.narration.trim()) {
    const alt = firstString(raw.narration, raw.narrator_brief, raw.brief, raw.text);
    if (alt) candidate.narration = alt;
  }

  const result = GMResponseSchema.safeParse(candidate);
  if (!result.success) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[borrowed] Malformed GM response", { raw: rawText });
    }
    return { narration: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, `GM response failed schema validation — ${formatZodDiagnostic(result.error)}`) };
  }

  logEnding((obj as RawGMObject & { ending?: unknown }).ending, result.data.ending ?? null);
  return {
    narration: result.data.narration,
    state: result.data.state,
    ending: result.data.ending ?? null,
    ambience: resolveAmbience(obj),
    story_ledger_append: result.data.story_ledger_append,
    raw: rawText,
    malformed: false
  };
}

export function isStateEmpty(s: GameState | null | undefined): boolean {
  if (!s)
    return true;
  return !s.scene && !s.time && !s.summary && !s.hidden_state && (!s.inventory || s.inventory.length === 0) && (!s.npcs || s.npcs.length === 0) && (!s.clues || s.clues.length === 0);
}
