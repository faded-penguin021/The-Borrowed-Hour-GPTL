import { sanitizeAmbience } from "../ambience/tables.js";
import { VALID_ENDINGS } from "../data/constants.js";

export function firstString(...candidates) {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

export function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function repairJSON(text) {
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
      if (ch === `
`) {
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

export function normalizeGameState(s) {
  const safe = s && typeof s === "object" ? s : {};
  return {
    scene: typeof safe.scene === "string" ? safe.scene : "",
    time: typeof safe.time === "string" ? safe.time : "",
    inventory: Array.isArray(safe.inventory) ? safe.inventory.filter((x) => typeof x === "string") : [],
    npcs: Array.isArray(safe.npcs) ? safe.npcs.filter((x) => x && typeof x === "object").map((x) => ({
      name: typeof x.name === "string" ? x.name : "",
      note: typeof x.note === "string" ? x.note : ""
    })).filter((x) => x.name) : [],
    clues: Array.isArray(safe.clues) ? safe.clues.filter((x) => typeof x === "string") : [],
    summary: typeof safe.summary === "string" ? safe.summary : "",
    hidden_state: typeof safe.hidden_state === "string" ? safe.hidden_state : ""
  };
}

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

export function parseGMLogicResponse(rawText) {
  let text = (rawText || "").trim();
  text = text.replace(/^\s*[`~]{3}[ \t]*[a-zA-Z]*[ \t]*\r?\n?/, "");
  text = text.replace(/\r?\n?[ \t]*[`~]{3}[ \t]*$/, "");
  text = text.trim();

  let parsed = tryParseJSON(text);
  if (!parsed) {
    const first = text.indexOf("{");
    if (first >= 0) {
      const end = findBalancedJSONEnd(text, first);
      if (end > first) parsed = tryParseJSON(text.slice(first, end + 1));
      if (!parsed) {
        const last = text.lastIndexOf("}");
        if (last > first) parsed = tryParseJSON(text.slice(first, last + 1));
      }
    }
  }
  if (!parsed) {
    const repaired = repairJSON(text);
    parsed = tryParseJSON(repaired);
    if (!parsed) {
      const first = repaired.indexOf("{");
      if (first >= 0) {
        const end = findBalancedJSONEnd(repaired, first);
        if (end > first) parsed = tryParseJSON(repaired.slice(first, end + 1));
        if (!parsed) {
          const last = repaired.lastIndexOf("}");
          if (last > first) parsed = tryParseJSON(repaired.slice(first, last + 1));
        }
      }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { narrator_brief: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, parsed, "Malformed GM logic response — could not parse JSON.") };
  }

  const narratorBrief = firstString(parsed.narrator_brief, parsed.narration, parsed.brief, parsed.text);
  const stateOk = parsed.state && typeof parsed.state === "object";

  if (!narratorBrief || !stateOk) {
    const missing = [];
    if (!narratorBrief) missing.push("narrator_brief (also tried: narration, brief, text)");
    if (!stateOk) missing.push("state");
    return { narrator_brief: "", state: null, ending: null, raw: rawText, malformed: true, diagnostic: buildParseDiagnostic(rawText, parsed, `GM logic response missing required field(s): ${missing.join(", ")}.`) };
  }

  const ending = typeof parsed.ending === "string" && parsed.ending.trim() ? parsed.ending.trim() : null;
  const ambience = "ambience" in parsed ? sanitizeAmbience(parsed.ambience) : undefined;
  const ambienceExplicitNull = parsed.ambience === null;
  return { narrator_brief: narratorBrief, state: normalizeGameState(parsed.state), ending, ambience: ambienceExplicitNull ? null : ambience, raw: rawText, malformed: false };
}

export function parseGMResponse(rawText) {
  let text = (rawText || "").trim();
  text = text.replace(/^\s*[`~]{3}[ \t]*[a-zA-Z]*[ \t]*\r?\n?/, "");
  text = text.replace(/\r?\n?[ \t]*[`~]{3}[ \t]*$/, "");
  text = text.trim();
  let parsed = tryParseJSON(text);
  if (!parsed) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      parsed = tryParseJSON(text.slice(first, last + 1));
    }
  }
  if (!parsed) {
    const repaired = repairJSON(text);
    parsed = tryParseJSON(repaired);
    if (!parsed) {
      const first = repaired.indexOf("{");
      const last = repaired.lastIndexOf("}");
      if (first >= 0 && last > first) {
        parsed = tryParseJSON(repaired.slice(first, last + 1));
      }
    }
    if (parsed && typeof console !== "undefined" && console.warn) {
      console.warn("[borrowed] GM response recovered via JSON repair pass");
    }
  }
  const narration = parsed && typeof parsed === "object"
    ? firstString(parsed.narration, parsed.narrator_brief, parsed.brief, parsed.text)
    : "";
  if (!parsed || typeof parsed !== "object" || !narration) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[borrowed] Malformed GM response", { raw: rawText });
    }
    const reasonGuess = parsed && typeof parsed === "object" && !narration
      ? "Parsed object had no usable narration field (tried: narration, narrator_brief, brief, text)."
      : null;
    return {
      narration: "",
      state: null,
      ending: null,
      raw: rawText,
      malformed: true,
      diagnostic: buildParseDiagnostic(rawText, parsed, reasonGuess)
    };
  }
  const state = normalizeGameState(parsed.state);
  const ending = VALID_ENDINGS.has(parsed.ending) ? parsed.ending : null;
  const ambience = "ambience" in parsed ? sanitizeAmbience(parsed.ambience) : undefined;
  const ambienceExplicitNull = parsed.ambience === null;
  return { narration, state, ending, ambience: ambienceExplicitNull ? null : ambience, raw: rawText, malformed: false };
}

export function isStateEmpty(s) {
  if (!s)
    return true;
  return !s.scene && !s.time && !s.summary && !s.hidden_state && (!s.inventory || s.inventory.length === 0) && (!s.npcs || s.npcs.length === 0) && (!s.clues || s.clues.length === 0);
}
