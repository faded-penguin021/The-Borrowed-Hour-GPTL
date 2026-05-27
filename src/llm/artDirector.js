// The Art Director — a 4th LLM role that gates and structures image generation.
//
// Two distinct tools:
//   * ART_DIRECTOR_BOOTSTRAP_TOOL — called once on first turn (in parallel with
//     the Opening Engine) to seed the realm's Style Bible + initial Visual
//     Ledger entries. Locks in the aesthetic for the whole chronicle.
//   * ART_DIRECTOR_TURN_TOOL — called every turn (when codex.mode !== "off"),
//     in parallel with the Narrator. Decides whether the scene `warrants_
//     illustration`, composes a structured prompt, and updates the ledger.
//
// The final image prompt is always assembled by composeImagePrompt() —
// prepending the Style Bible and referencing Visual Ledger tags — so that the
// LLM cannot drift away from the locked aesthetic or invent new appearances
// for recurring NPCs.
import { languageNameFor, DEFAULT_LANGUAGE } from "../data/languages.js";

// Per-realm aesthetic anchors. The bootstrap LLM is constrained to extend
// these, not replace them — preventing a sepia codex from drifting into a
// neon scene halfway through.
export const REALM_AESTHETIC_SEEDS = {
  echo: {
    era: "19th-century chiaroscuro etching",
    medium: "fine ink wash, plate-printed engraving",
    palette: ["sepia", "bone white", "deep umber", "ember"],
    mood_words: ["recursive", "hushed", "uncanny"],
    negatives: ["modern", "photographic", "neon", "saturated color", "anime", "cgi", "text", "watermark", "logo"]
  },
  neon: {
    era: "late-night noir lithograph",
    medium: "halftone print with selective rim-light",
    palette: ["ink black", "wet asphalt", "cold neon teal", "dim magenta"],
    mood_words: ["wired", "rain-slick", "watchful"],
    negatives: ["medieval", "high fantasy", "watercolor pastoral", "text", "watermark", "logo"]
  },
  omen: {
    era: "Renaissance devotional fresco fragment",
    medium: "egg tempera on plaster, gold-leaf accents, slight craquelure",
    palette: ["bone", "iron oxide red", "lapis", "tarnished gold"],
    mood_words: ["sacred", "foreboding", "weighted"],
    negatives: ["modern", "photographic", "neon", "anime", "cgi", "text", "watermark"]
  },
  dream: {
    era: "Symbolist drypoint with watercolor wash",
    medium: "soft etching over diluted gouache",
    palette: ["dawn rose", "mist grey", "lichen green", "ash blue"],
    mood_words: ["liminal", "tender", "uncertain"],
    negatives: ["photographic", "high contrast", "neon", "cgi", "text", "watermark"]
  },
  wild: {
    era: "monochrome plate from a naturalist's leather-bound codex",
    medium: "fine pen-and-ink with selective wash",
    palette: ["bone", "umber", "iron"],
    mood_words: ["uncatalogued", "patient", "watchful"],
    negatives: ["modern", "photographic", "neon", "cgi", "anime", "text", "watermark", "logo"]
  }
};

export const ART_DIRECTOR_BOOTSTRAP_TOOL = {
  name: "seed_codex",
  description: "Seed the locked aesthetic Style Bible and an initial Visual Ledger of recurring subjects for the chronicle.",
  input_schema: {
    type: "object",
    properties: {
      style_bible: {
        type: "object",
        properties: {
          era: { type: "string", description: "Locked period / medium (e.g. '19th-century chiaroscuro etching')." },
          medium: { type: "string", description: "Printmaking or painting medium." },
          palette: { type: "array", items: { type: "string" }, description: "3–5 colour words." },
          composition: { type: "string", description: "Default composition rule (e.g. 'centered tableau, deep shadow, eye-level')." },
          negatives: { type: "array", items: { type: "string" }, description: "Terms to forbid in every prompt." }
        },
        required: ["era", "medium", "palette", "composition", "negatives"]
      },
      visual_ledger: {
        type: "array",
        description: "Initial recurring subjects gleaned from the seed: the player's body in space, named NPCs, signature locations. Each entry is a stable id and a short tag list.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Stable id like 'npc:elias' or 'location:chamber' or 'self:protagonist'." },
            tags: { type: "array", items: { type: "string" }, description: "3–6 short physical/visual tags. No interior states." }
          },
          required: ["id", "tags"]
        }
      }
    },
    required: ["style_bible", "visual_ledger"]
  }
};

export const ART_DIRECTOR_TURN_TOOL = {
  name: "curate_plate",
  description: "Decide whether THIS turn warrants an illustration plate. If yes, compose a tight visual brief and update the Visual Ledger with any new recurring subjects.",
  input_schema: {
    type: "object",
    properties: {
      warrants_illustration: {
        type: "boolean",
        description: "True ONLY for genuine narrative milestones: a first reveal, a dramatic shift, a set-piece, the ending. The default answer is false. Routine conversation or transit turns do not warrant a plate."
      },
      milestone_reason: {
        type: "string",
        description: "One short phrase justifying the decision (e.g. 'first reveal of the cloister', 'verdict lands'). Required even when warrants_illustration is false — explain the absence."
      },
      subject_ids: {
        type: "array",
        items: { type: "string" },
        description: "Ledger ids that should appear in this plate (e.g. ['npc:elias','location:chamber']). Use existing ids when possible; only invent new ids that you ALSO declare in ledger_updates."
      },
      scene_clause: {
        type: "string",
        description: "12–35 words: the specific tableau for THIS turn, in visual terms — what the eye sees, the composition, the light. NO interior states, NO dialogue, NO meta. The Style Bible and ledger tags are prepended automatically."
      },
      extra_negatives: {
        type: "array",
        items: { type: "string" },
        description: "Optional one-off negatives beyond the Style Bible (e.g. 'no faces' if the scene calls for it)."
      },
      ledger_updates: {
        type: "array",
        description: "New or revised ledger entries. Use sparingly — add a subject only when it has appeared or is appearing now and is likely to recur.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            tags: { type: "array", items: { type: "string" } }
          },
          required: ["id", "tags"]
        }
      }
    },
    required: ["warrants_illustration", "milestone_reason"]
  }
};

const realmKey = (premise) => {
  const r = premise?.realm;
  return REALM_AESTHETIC_SEEDS[r] ? r : "wild";
};

export const buildBootstrapSystem = (premise, language = DEFAULT_LANGUAGE) => {
  const seed = REALM_AESTHETIC_SEEDS[realmKey(premise)];
  return `You are the Art Director of an immersive text adventure called "The Borrowed Hour". This chronicle takes place in the ${premise.realmLabel || premise.realm} realm. Illustrations in this codex are RARE plates in a leather-bound manuscript — not a visual novel. Your job on this very first turn is to LOCK IN the aesthetic for the whole chronicle and to seed an initial Visual Ledger of recurring subjects.

REALM AESTHETIC ANCHORS (you must build the Style Bible from these — do not invent a different era):
- era: ${seed.era}
- medium: ${seed.medium}
- palette: ${seed.palette.join(", ")}
- mood words: ${seed.mood_words.join(", ")}
- forbidden: ${seed.negatives.join(", ")}

INITIAL SEED FOR THE CHRONICLE:
${premise.seed}

CALL THE TOOL \`seed_codex\` with:
1) A Style Bible that EXTENDS the anchors above (you may add composition specifics, a couple of palette nuances). DO NOT change the era or contradict the forbidden list.
2) A small Visual Ledger (2–5 entries) for what is already named in the seed: the player's body / role, any named NPCs, signature locations. Use stable ids like \`self:protagonist\`, \`npc:<name-lowercased>\`, \`location:<short-slug>\`. Each entry: 3–6 short physical/visual tags — what the eye sees, never interior states.

Write tag values plainly in English (these are prompt fragments for an image model). Output ONLY the tool call.`;
};

export const buildTurnSystem = (premise, styleBible, visualLedger, language = DEFAULT_LANGUAGE) => {
  const ledgerLines = (visualLedger || []).map((e) => `  - ${e.id}: ${(e.tags || []).join(", ")}`).join("\n") || "  (empty)";
  const sb = styleBible || {};
  return `You are the Art Director of an immersive text adventure. The narrative text is sovereign — your job is to CURATE rare illustration plates that feel like inserts in a leather-bound manuscript. Most turns DO NOT warrant a plate; the default answer is no.

LOCKED STYLE BIBLE (do not contradict — it is prepended to every prompt automatically):
- era: ${sb.era || "(unset)"}
- medium: ${sb.medium || "(unset)"}
- palette: ${(sb.palette || []).join(", ") || "(unset)"}
- composition: ${sb.composition || "(unset)"}
- negatives: ${(sb.negatives || []).join(", ") || "(unset)"}

CURRENT VISUAL LEDGER (recurring subjects with stable tags):
${ledgerLines}

WHEN TO WARRANT A PLATE (be ruthless):
- A first reveal of an important person, place, or object.
- A dramatic shift: a confrontation, a verdict, a transformation, a death.
- A set-piece tableau that the narration already leans into visually.
- The ending beat of the chronicle.

WHEN NOT TO:
- Conversation, transit, small moves, internal thought, deliberation.
- Anything routine, even if vivid.

RULES:
- When in doubt, set warrants_illustration to false and write the reason.
- When you do warrant one, REUSE ledger ids (\`npc:<name>\`, \`location:<slug>\`, \`self:protagonist\`) so the recurring subjects look the same across plates.
- scene_clause is purely visual: what the eye sees, the composition, the light. No interior states, no dialogue, no narrative meta.
- Add ledger_updates ONLY for genuinely new recurring subjects.

Call the tool \`curate_plate\` and output ONLY the tool call.`;
};

export const composeImagePrompt = ({ styleBible, visualLedger, subjectIds, sceneClause, extraNegatives }) => {
  const sb = styleBible || {};
  const ledgerById = new Map((visualLedger || []).map((e) => [e.id, e]));
  const subjectFragments = (subjectIds || [])
    .map((id) => ledgerById.get(id))
    .filter(Boolean)
    .map((e) => `[${e.id.split(":").slice(1).join(":") || e.id}: ${(e.tags || []).join(", ")}]`);
  const styleParts = [
    sb.era,
    sb.medium,
    sb.palette ? `palette: ${sb.palette.join(", ")}` : null,
    sb.composition
  ].filter(Boolean).join(" | ");
  const subjectPart = subjectFragments.length ? `Subjects: ${subjectFragments.join(" ")}` : null;
  const sceneParts = [styleParts, subjectPart, sceneClause].filter(Boolean);
  const prompt = sceneParts.join(" || ");
  const negatives = [...(sb.negatives || []), ...(extraNegatives || [])];
  return { prompt, negatives: Array.from(new Set(negatives)) };
};

export const mergeLedger = (current, updates) => {
  if (!Array.isArray(updates) || updates.length === 0) return current || [];
  const byId = new Map((current || []).map((e) => [e.id, e]));
  for (const u of updates) {
    if (!u || typeof u.id !== "string" || !Array.isArray(u.tags)) continue;
    byId.set(u.id, { id: u.id, tags: u.tags.filter((t) => typeof t === "string" && t.trim()) });
  }
  return Array.from(byId.values());
};

// Minimal parsers — separate from parse.js so they can evolve independently.
const tryJSON = (s) => { try { return JSON.parse(s); } catch { return null; } };

export const parseBootstrapResponse = (raw) => {
  if (!raw) return { malformed: true };
  let txt = String(raw).trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  let parsed = tryJSON(txt);
  if (!parsed) {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first >= 0 && last > first) parsed = tryJSON(txt.slice(first, last + 1));
  }
  if (!parsed || typeof parsed !== "object") return { malformed: true };
  const sb = parsed.style_bible;
  const ledger = Array.isArray(parsed.visual_ledger) ? parsed.visual_ledger.filter((e) => e && typeof e.id === "string" && Array.isArray(e.tags)) : [];
  if (!sb || typeof sb !== "object") return { malformed: true };
  return {
    style_bible: {
      era: typeof sb.era === "string" ? sb.era : "",
      medium: typeof sb.medium === "string" ? sb.medium : "",
      palette: Array.isArray(sb.palette) ? sb.palette.filter((s) => typeof s === "string") : [],
      composition: typeof sb.composition === "string" ? sb.composition : "",
      negatives: Array.isArray(sb.negatives) ? sb.negatives.filter((s) => typeof s === "string") : []
    },
    visual_ledger: ledger.map((e) => ({ id: e.id, tags: e.tags.filter((t) => typeof t === "string") }))
  };
};

export const parseTurnResponse = (raw) => {
  if (!raw) return { malformed: true };
  let txt = String(raw).trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  let parsed = tryJSON(txt);
  if (!parsed) {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first >= 0 && last > first) parsed = tryJSON(txt.slice(first, last + 1));
  }
  if (!parsed || typeof parsed !== "object") return { malformed: true };
  return {
    warrants_illustration: !!parsed.warrants_illustration,
    milestone_reason: typeof parsed.milestone_reason === "string" ? parsed.milestone_reason : "",
    subject_ids: Array.isArray(parsed.subject_ids) ? parsed.subject_ids.filter((s) => typeof s === "string") : [],
    scene_clause: typeof parsed.scene_clause === "string" ? parsed.scene_clause : "",
    extra_negatives: Array.isArray(parsed.extra_negatives) ? parsed.extra_negatives.filter((s) => typeof s === "string") : [],
    ledger_updates: Array.isArray(parsed.ledger_updates) ? parsed.ledger_updates.filter((e) => e && typeof e.id === "string" && Array.isArray(e.tags)) : []
  };
};
