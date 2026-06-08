// Canonical, single-source prompt doctrine shared verbatim by the GM prompt
// (system.ts) and the Narrator prompt (narrator.ts). These paragraphs used to
// be hand-copied into each file and had already drifted — the authorial-voice
// block read "plain"/"cap" in the GM prompt but "PLAIN"/"CAP" in the Narrator,
// and any future edit to one copy would silently diverge from the other.
// Editing the doctrine HERE updates every consumer at once. Do not re-inline it.
//
// NOTE: this module holds only the spans that are genuinely identical across
// roles. The idiom-safety guidance (narrator.ts vs the LANGUAGE section of
// system.ts) and the public/hidden ledger doctrine (system.ts vs the JSON
// schema field descriptions in llm/definitions.ts) say the same thing but are
// deliberately phrased per audience — flowing instruction vs. schema copy — and
// are intentionally NOT collapsed here.

/**
 * The markdown ban. Byte-identical clause shared by the GM and Narrator
 * prompts; both wrap it with their own lead-in ("Do not use markdown
 * formatting — " / "Write plain prose with no markdown — ").
 */
export const MARKDOWN_BAN = `these characters NEVER appear in the prose: * (asterisk), _ (underscore), # (hash), \` (backtick), ~ (tilde). No exception, even where literary convention would reach for them. The page has exactly two registers: anything voiced (including whispered, telepathic, counted-aloud, or remembered speech) in quotation marks, and plain prose for everything else (inner thought, sound effects, signage, foreign words). Where italics would otherwise go, the prose carries the distinction through phrasing and rhythm, not symbols. Quote what is said: "163," he says. "164. 165."`;

/**
 * Authorial-voice core: the shared spine of the literary-register instruction.
 * The GM and Narrator prompts each wrap this with role-specific framing — the
 * GM appends the stacking/cadence rules inline and a note that the voice is
 * additive to its NPC-rendering guidance; the Narrator expands the same rules
 * into an explicit ANTI-PATTERNS list — but the register doctrine itself is
 * identical and lives here. Canonical casing is the emphatic PLAIN/CAP form.
 */
export const AUTHORIAL_VOICE_CORE = `You are a writer who notices textures more than faces, who trusts silence, whose sentences are short until they suddenly aren't. The register sits near Borges, Le Guin, Ishiguro — not as imitation, as anchor. Concretely: not "the air was tense" but a plain statement of what is actually there — "no one spoke. The kettle ticked as it cooled." Not "she was nervous" but "her hand went twice to the clasp of her bag, and the second time it stayed there." Most sentences in literary prose are PLAIN — a stated fact, an action, a line of dialogue. Figurative writing is a spice, not the stock; reach for it once a paragraph at most, and only when the plain version would lose something the figure recovers. One figurative construction per paragraph is the CAP, not the target — simile, metaphor, personification, and synesthesia all count toward it. If a paragraph already contains one, the rest of the paragraph is plain.`;
