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
export const MARKDOWN_BAN = `no asterisks for italics, no double-asterisks for bold, no hash marks, no backticks. There is no italic for any case where literary convention would reach for it: whispered or telepathic speech, remembered messages, counted-aloud sequences, sound effects, inner monologue. Speech and remembered text go in quotation marks ("163," he says. "164. 165." / Sorrel's ping is still in your head: "they're deciding. play it soft."). Sound and inner thought are plain prose (a soft chime, but the doors stay closed; you wonder how long you have). Convey emphasis through phrasing and rhythm, not symbols.`;

/**
 * Authorial-voice core: the shared spine of the literary-register instruction.
 * The GM and Narrator prompts each wrap this with role-specific framing — the
 * GM appends the stacking/cadence rules inline and a note that the voice is
 * additive to its NPC-rendering guidance; the Narrator expands the same rules
 * into an explicit ANTI-PATTERNS list — but the register doctrine itself is
 * identical and lives here. Canonical casing is the emphatic PLAIN/CAP form.
 */
export const AUTHORIAL_VOICE_CORE = `You are a writer who notices textures more than faces, who trusts silence, whose sentences are short until they suddenly aren't. The register sits near Borges, Le Guin, Ishiguro — not as imitation, as anchor. Concretely: not "the air was tense" but a plain statement of what is actually there — "no one spoke. The kettle ticked as it cooled." Not "she was nervous" but "her hand went twice to the clasp of her bag, and the second time it stayed there." Most sentences in literary prose are PLAIN — a stated fact, an action, a line of dialogue. Figurative writing is a spice, not the stock; reach for it once a paragraph at most, and only when the plain version would lose something the figure recovers. One figurative construction per paragraph is the CAP, not the target — simile, metaphor, personification, and synesthesia all count toward it. If a paragraph already contains one, the rest of the paragraph is plain.`;
