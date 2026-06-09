import type { BootstrapParseResult, ComposedImagePrompt, Premise, RealmAestheticSeed, StyleBible, ToolDefinition, TurnParseResult, VisualLedgerEntry } from "../types";
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
import { DEFAULT_LANGUAGE } from "../data/languages";

export const REALM_AESTHETIC_SEEDS: Record<string, RealmAestheticSeed> = {
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

export const ART_DIRECTOR_BOOTSTRAP_TOOL: ToolDefinition = {
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

export const ART_DIRECTOR_TURN_TOOL: ToolDefinition = {
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
        description: "PRIVATE gate reasoning — never shown to the player. One short phrase justifying the decision (e.g. 'first reveal of the cloister', 'verdict lands'). Required even when warrants_illustration is false — explain the absence. This is internal bookkeeping; the player-facing line is `caption`, which must never contain this kind of significance-talk."
      },
      caption: {
        type: "string",
        description: "PLAYER-FACING plate caption — the line engraved beneath the plate in a manuscript. 2 to 7 words. PURELY DESCRIPTIVE of what the plate depicts, in the player's present knowledge: a place, a figure, an object, a moment as seen by the eye. Examples: 'The woman in the green coat', 'Holborn, from the eastbound platform', 'The locked reliquary', 'Snow on the cloister steps'. FORBIDDEN: any commentary on narrative significance or its absence — never 'reveal', 'shift', 'turning point', 'the moment when', 'routine', 'nothing', 'no significant…', and never name a hidden identity or a fact the player has not yet been shown. No trailing punctuation. Always write this when warrants_illustration is true; it is independent of the gate reasoning above."
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

const realmKey = (premise: Premise): string => {
  const r = premise?.realm;
  return REALM_AESTHETIC_SEEDS[r] ? r : "wild";
};

export const buildBootstrapSystem = (premise: Premise, _language: string = DEFAULT_LANGUAGE): string => {
  if (premise?.isCustom) {
    return `You are the Art Director of an immersive text adventure called "The Borrowed Hour". Illustrations in this codex are RARE plates in a manuscript. Your job on this very first turn is to LOCK IN the aesthetic for the whole chronicle based on the player's custom scenario, and to seed an initial Visual Ledger of recurring subjects.

INITIAL SEED FOR THE CHRONICLE:
${premise.seed}

CALL THE TOOL \`seed_codex\` with:
1) A Style Bible that PERFECTLY MATCHES the genre and tone of the seed above. You MUST invent the \`era\`, \`medium\`, \`palette\`, and \`composition\` to fit the story (e.g. "70s sci-fi paperback cover", "neon-drenched cyberpunk lithograph", "1950s cinematic noir photography", "medieval illuminated manuscript", "Studio Ghibli watercolor still"). Commit fully — once locked, this aesthetic governs every plate in the chronicle.
   - ALWAYS include these in your \`negatives\` list: "text", "watermark", "logo", "ui".
2) A small Visual Ledger (2–5 entries) for what is already named in the seed: the player's body / role, any named NPCs, signature locations. Use stable ids like \`self:protagonist\`, \`npc:<name-lowercased>\`, \`location:<short-slug>\`. Each entry: 3–6 short physical/visual tags — what the eye sees, never interior states.

Write tag values plainly in English (these are prompt fragments for an image model). Output ONLY the tool call.`;
  }

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

export const buildTurnSystem = (premise: Premise, styleBible: StyleBible, visualLedger: VisualLedgerEntry[], _language: string = DEFAULT_LANGUAGE): string => {
  const ledgerLines = (visualLedger || []).map((e) => `  - ${e.id}: ${(e.tags || []).join(", ")}`).join("\n") || "  (empty)";
  const sb = (styleBible || {}) as Partial<StyleBible>;
  return `You are the Art Director of an immersive text adventure. The narrative text is sovereign — your job is to CURATE rare illustration plates that feel like inserts in a leather-bound manuscript. Most turns DO NOT warrant a plate; the default answer is no.

LOCKED STYLE BIBLE (do not contradict — it is prepended to every prompt automatically):
- era: ${sb.era || "(unset)"}
- medium: ${sb.medium || "(unset)"}
- palette: ${(sb.palette || []).join(", ") || "(unset)"}
- composition: ${sb.composition || "(unset)"}
- negatives: ${(sb.negatives || []).join(", ") || "(unset)"}

CURRENT VISUAL LEDGER (recurring subjects with stable tags):
${ledgerLines}

WHEN TO WARRANT A PLATE — be ruthless. A plate is justified by a specific, nameable beat the prose already leans into visually, never by absence. The default answer is no.
  RIGHT (warrants): a first reveal, a dramatic shift (confrontation, verdict, transformation, death), a set-piece tableau, the ending — milestone_reason names a concrete beat ("first reveal of the cloister", "verdict lands", "the door opens onto the snow").
  WRONG (does NOT warrant): if the only honest milestone_reason you could write is a negation — "no significant event", "routine", "nothing notable", "minor moment" — warrants_illustration MUST be false. Conversation, transit, internal thought, and routine moves do not warrant a plate even when vivid.

RULES:
- When in doubt, set warrants_illustration to false and write the reason.
- If warrants_illustration is true, milestone_reason MUST name a concrete beat: a specific reveal, encounter, threshold, transformation, or finale. Not a negation.
- If warrants_illustration is true, scene_clause MUST be present and 12–35 words. Without it, set warrants_illustration to false.
- When you do warrant one, REUSE ledger ids (\`npc:<name>\`, \`location:<slug>\`, \`self:protagonist\`) so the recurring subjects look the same across plates.
- scene_clause is purely visual: what the eye sees, the composition, the light. No interior states, no dialogue, no narrative meta.
- Add ledger_updates ONLY for genuinely new recurring subjects.
- CONTINUITY: if a [Previous plate scene clause] is provided, ensure returning subjects match their ledger tags exactly — same gender, same clothing, same features. The ledger is the single source of truth for how recurring subjects look.

THE CAPTION vs THE GATE REASON — CRITICAL (these must not be confused):
- \`milestone_reason\` is PRIVATE. It explains your yes/no decision and the player never sees it. It is allowed to talk about significance ("first reveal", "routine transit, no shift").
- \`caption\` is PUBLIC. It is printed under the plate like the engraved line beneath an illustration in an old book. It must NEVER leak your judgement of significance. It only names what the plate shows, in the player's own present knowledge. WRONG caption: "routine conversation, no significant shift or reveal", "the turning point", "a moment of tension". RIGHT caption: "The woman in the green coat", "The 8:11, nearing Holborn", "The reliquary, unopened". Whenever you warrant a plate, write a clean descriptive caption — it is independent of why you decided to draw it.

Call the tool \`curate_plate\` and output ONLY the tool call.`;
};

// Defensive scrub of the player-facing plate caption. Even with explicit
// instructions, smaller Art Director models sometimes echo their gate
// reasoning into the caption ("routine conversation, no significant shift").
// That is the exact epistemic leak the caption is meant to avoid, so a caption
// that smells of significance-talk (or is over-long, or sentence-like) is
// dropped — a clean untitled plate beats a leaky caption.
const CAPTION_LEAK = /\b(no\s+significant|significant|reveal|reveals|revealing|shift|turning[\s-]?point|climax|milestone|moment\s+of|the\s+moment\s+when|nothing|none|routine|mundane|uneventful|minor|major\s+(beat|moment)|no\s+(major|notable|real)|tension|stakes|foreshadow|setup|set[\s-]?piece|plot)\b/i;
export const cleanPlateCaption = (caption: string): string => {
  const c = (caption || "").trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/[.!]+$/g, "").trim();
  if (!c) return "";
  if (CAPTION_LEAK.test(c)) return "";
  const words = c.split(/\s+/);
  if (words.length > 9 || c.length > 64) return ""; // a caption, not a sentence
  return c;
};

// Fallback engraving for plates whose curated caption was unusable — the common
// case under "always" mode, where every turn yields a plate even when the Art
// Director judged the beat insignificant and its caption leaked gate-talk.
// The scene clause is purely visual by contract ("what the eye sees"), so its
// opening phrase describes the plate without any significance to leak. Beats an
// untitled plate.
export const captionFromScene = (sceneClause: string): string => {
  const first = (sceneClause || "").trim().split(/[—–;:.,]/)[0].trim().replace(/[.!]+$/g, "");
  if (!first) return "";
  const short = first.split(/\s+/).slice(0, 9).join(" ");
  return short.charAt(0).toUpperCase() + short.slice(1);
};

export const composeImagePrompt = ({ styleBible, visualLedger, subjectIds, sceneClause, extraNegatives }: { styleBible: StyleBible, visualLedger: VisualLedgerEntry[], subjectIds?: string[], sceneClause?: string, extraNegatives?: string[] }): ComposedImagePrompt => {
  const sb = (styleBible || {}) as Partial<StyleBible>;
  const ledgerById = new Map((visualLedger || []).map((e) => [e.id, e]));
  const subjectFragments = (subjectIds || [])
    .map((id) => ledgerById.get(id))
    .filter((e): e is VisualLedgerEntry => Boolean(e))
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

export const mergeLedger = (current: VisualLedgerEntry[], updates: VisualLedgerEntry[]): VisualLedgerEntry[] => {
  if (!Array.isArray(updates) || updates.length === 0) return current || [];
  const byId = new Map((current || []).map((e) => [e.id, e]));
  for (const u of updates) {
    if (!u || typeof u.id !== "string" || !Array.isArray(u.tags)) continue;
    byId.set(u.id, { id: u.id, tags: u.tags.filter((t) => typeof t === "string" && t.trim()) });
  }
  return Array.from(byId.values());
};

// Minimal parsers — separate from parse.js so they can evolve independently.
const tryJSON = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };

// Minimal shapes for the untyped Art Director JSON before field-level narrowing.
interface RawStyleBible {
  era?: unknown;
  medium?: unknown;
  palette?: unknown;
  composition?: unknown;
  negatives?: unknown;
}
interface RawLedgerEntry {
  id?: unknown;
  tags?: unknown;
}
interface RawBootstrapResponse {
  style_bible?: unknown;
  visual_ledger?: unknown;
}
interface RawTurnResponse {
  warrants_illustration?: unknown;
  milestone_reason?: unknown;
  caption?: unknown;
  subject_ids?: unknown;
  scene_clause?: unknown;
  extra_negatives?: unknown;
  ledger_updates?: unknown;
}

const isLedgerEntry = (e: unknown): e is { id: string; tags: unknown[] } =>
  !!e && typeof e === "object" && typeof (e as RawLedgerEntry).id === "string" && Array.isArray((e as RawLedgerEntry).tags);

export const parseBootstrapResponse = (raw: string): BootstrapParseResult => {
  if (!raw) return { malformed: true };
  const txt = String(raw).trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  let parsed = tryJSON(txt);
  if (!parsed) {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first >= 0 && last > first) parsed = tryJSON(txt.slice(first, last + 1));
  }
  if (!parsed || typeof parsed !== "object") return { malformed: true };
  const root = parsed as RawBootstrapResponse;
  const sb = root.style_bible;
  const ledger = Array.isArray(root.visual_ledger) ? root.visual_ledger.filter(isLedgerEntry) : [];
  if (!sb || typeof sb !== "object") return { malformed: true };
  const rawSb = sb as RawStyleBible;
  return {
    style_bible: {
      era: typeof rawSb.era === "string" ? rawSb.era : "",
      medium: typeof rawSb.medium === "string" ? rawSb.medium : "",
      palette: Array.isArray(rawSb.palette) ? rawSb.palette.filter((s): s is string => typeof s === "string") : [],
      composition: typeof rawSb.composition === "string" ? rawSb.composition : "",
      negatives: Array.isArray(rawSb.negatives) ? rawSb.negatives.filter((s): s is string => typeof s === "string") : []
    },
    visual_ledger: ledger.map((e) => ({ id: e.id, tags: e.tags.filter((t): t is string => typeof t === "string") }))
  };
};

export const parseTurnResponse = (raw: string): TurnParseResult => {
  if (!raw) return { malformed: true };
  const txt = String(raw).trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  let parsed = tryJSON(txt);
  if (!parsed) {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first >= 0 && last > first) parsed = tryJSON(txt.slice(first, last + 1));
  }
  if (!parsed || typeof parsed !== "object") return { malformed: true };
  const root = parsed as RawTurnResponse;
  return {
    warrants_illustration: !!root.warrants_illustration,
    milestone_reason: typeof root.milestone_reason === "string" ? root.milestone_reason : "",
    caption: typeof root.caption === "string" ? root.caption : "",
    subject_ids: Array.isArray(root.subject_ids) ? root.subject_ids.filter((s): s is string => typeof s === "string") : [],
    scene_clause: typeof root.scene_clause === "string" ? root.scene_clause : "",
    extra_negatives: Array.isArray(root.extra_negatives) ? root.extra_negatives.filter((s): s is string => typeof s === "string") : [],
    ledger_updates: (Array.isArray(root.ledger_updates) ? root.ledger_updates.filter(isLedgerEntry) : []).map((e) => ({ id: e.id, tags: e.tags as string[] }))
  };
};
