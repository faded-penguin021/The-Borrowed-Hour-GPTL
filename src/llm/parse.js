// @ts-check
import { sanitizeAmbience } from "../ambience/tables.js";
import { GMLogicResponseSchema, GMResponseSchema } from "./schemas.js";

/**
 * @param {...unknown} candidates
 * @returns {string}
 */
export function firstString(...candidates) {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

/**
 * @param {string} text
 * @returns {any}
 */
export function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Scan from `start` (which must point at an opening `{`) to the matching close
 * brace, ignoring braces inside strings. Returns the index of the closing brace,
 * or -1 if the object never closes. Used to slice off trailing garbage (e.g. a
 * stray extra `}`) before parsing — this is structural extraction, not repair.
 * @param {string} text
 * @param {number} start
 * @returns {number}
 */
export function findBalancedJSONEnd(text, start) {
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

/**
 * JSON block extractor: strip markdown fences, attempt a direct parse, then fall
 * back to slicing the first balanced `{...}` object (dropping any trailing
 * garbage such as a stray extra brace), and finally to a first-`{`-to-last-`}`
 * slice. No regex repair of the contents — malformed payloads that survive this
 * extraction are surfaced via Zod instead.
 * @param {string} rawText
 * @returns {any}
 */
export function extractJSONBlock(rawText) {
  let text = (rawText || "").trim();
  text = text.replace(/^\s*[`~]{3}[ \t]*[a-zA-Z]*[ \t]*\r?\n?/, "");
  text = text.replace(/\r?\n?[ \t]*[`~]{3}[ \t]*$/, "");
  text = text.trim();

  let parsed = tryParseJSON(text);
  if (parsed) return parsed;

  const first = text.indexOf("{");
  if (first >= 0) {
    const end = findBalancedJSONEnd(text, first);
    if (end > first) {
      parsed = tryParseJSON(text.slice(first, end + 1));
      if (parsed) return parsed;
    }
    const last = text.lastIndexOf("}");
    if (last > first) {
      parsed = tryParseJSON(text.slice(first, last + 1));
      if (parsed) return parsed;
    }
  }
  return null;
}

/**
 * @param {string} rawText
 * @param {unknown} [parsed]
 * @param {string | null} [reasonGuess]
 * @returns {string}
 */
export function buildParseDiagnostic(rawText, parsed, reasonGuess) {
  const raw = rawText || "";
  const len = raw.length;
  const head = raw.slice(0, 200).replace(/\s+/g, " ");
  const tail = raw.slice(-200).replace(/\s+/g, " ");
  const endsCleanly = /[}\]]\s*$/.test(raw);
  const startsAsJson = /^\s*[{\[]/.test(raw);
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
 * @param {import("zod").ZodError} error
 * @returns {string}
 */
export function formatZodDiagnostic(error) {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * Resolve the explicit-null / present / absent semantics for ambience the same
 * way the previous parser did, then sanitize any present value.
 * @param {any} obj
 * @returns {AmbienceInput | null | undefined}
 */
function resolveAmbience(obj) {
  if (!obj || !("ambience" in obj)) return undefined;
  if (obj.ambience === null) return null;
  return sanitizeAmbience(obj.ambience);
}

/**
 * @param {string} rawText
 * @returns {GMLogicParseResult}
 */
export function parseGMLogicResponse(rawText) {
  const obj = extractJSONBlock(rawText);
  if (!obj || typeof obj !== "object") {
    return { narrator_brief: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, "Malformed GM logic response — could not parse JSON.") };
  }

  // Accept the legacy field aliases for the brief before strict validation.
  const candidate = { ...obj };
  if (typeof candidate.narrator_brief !== "string" || !candidate.narrator_brief.trim()) {
    const alt = firstString(obj.narrator_brief, obj.narration, obj.brief, obj.text);
    if (alt) candidate.narrator_brief = alt;
  }

  const result = GMLogicResponseSchema.safeParse(candidate);
  if (!result.success) {
    return { narrator_brief: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, `GM logic response failed schema validation — ${formatZodDiagnostic(result.error)}`) };
  }

  return {
    narrator_brief: result.data.narrator_brief,
    state: result.data.state,
    ending: result.data.ending ?? null,
    ambience: resolveAmbience(obj),
    raw: rawText,
    malformed: false
  };
}

/**
 * @param {string} rawText
 * @returns {GMParseResult}
 */
export function parseGMResponse(rawText) {
  const obj = extractJSONBlock(rawText);
  if (!obj || typeof obj !== "object") {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[borrowed] Malformed GM response", { raw: rawText });
    }
    return { narration: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, "Malformed GM response — could not parse JSON.") };
  }

  // Accept the legacy field aliases for the narration before strict validation.
  const candidate = { ...obj };
  if (typeof candidate.narration !== "string" || !candidate.narration.trim()) {
    const alt = firstString(obj.narration, obj.narrator_brief, obj.brief, obj.text);
    if (alt) candidate.narration = alt;
  }

  const result = GMResponseSchema.safeParse(candidate);
  if (!result.success) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[borrowed] Malformed GM response", { raw: rawText });
    }
    return { narration: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, obj, `GM response failed schema validation — ${formatZodDiagnostic(result.error)}`) };
  }

  return {
    narration: result.data.narration,
    state: result.data.state,
    ending: result.data.ending ?? null,
    ambience: resolveAmbience(obj),
    raw: rawText,
    malformed: false
  };
}

/**
 * @param {GameState | null | undefined} s
 * @returns {boolean}
 */
export function isStateEmpty(s) {
  if (!s)
    return true;
  return !s.scene && !s.time && !s.summary && !s.hidden_state && (!s.inventory || s.inventory.length === 0) && (!s.npcs || s.npcs.length === 0) && (!s.clues || s.clues.length === 0);
}
