import type { ContinuityFinding, GameState, StoryLedger } from "../types";
import { CONTINUITY_LEAK_NGRAM_WORDS } from "../data/constants";

// Machine-checkable continuity rules, run over the state DIFF a turn produces
// anyway. Nothing here reads a claim the model makes about itself: there is no
// "did you stay consistent" field to trust, because a model emits one of those
// without doing the work. The inputs are the previous state, the state the GM
// just returned, the ledger, and the prose the player is about to read.
//
// What these rules canNOT do, said plainly so nobody reads a clean result as a
// coherent story: they do not detect semantic contradiction. Prose that
// contradicts prose needs meaning, and meaning is exactly what this codebase
// refuses to build a gate on. These are tripwires for structural drift.

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * True when `secret` and `surface` share a run of CONTINUITY_LEAK_NGRAM_WORDS
 * consecutive words.
 *
 * A run that long is not coincidence in prose, which is what makes the check
 * cheap and quiet. Two limits are structural, not bugs to fix later: a secret
 * shorter than the window is never judged, and a PARAPHRASE is invisible — the
 * model can reveal the same fact in its own words and nothing here sees it.
 *
 * The matched phrase is deliberately NOT returned. A finding may end up on a
 * player-facing surface, and a finding that quotes the secret to prove the
 * secret leaked is its own leak — the same reason this repo's own rules report
 * that a credential is present without printing any part of its value.
 */
function sharesPhrase(secret: string, surface: string): boolean {
  const secretWords = words(secret);
  if (secretWords.length < CONTINUITY_LEAK_NGRAM_WORDS) return false;
  const haystack = ` ${words(surface).join(" ")} `;
  for (let i = 0; i + CONTINUITY_LEAK_NGRAM_WORDS <= secretWords.length; i++) {
    const gram = secretWords.slice(i, i + CONTINUITY_LEAK_NGRAM_WORDS).join(" ");
    if (haystack.includes(` ${gram} `)) return true;
  }
  return false;
}

/** Everything in a state the player is allowed to see, as one blob. */
function publicText(state: GameState): string {
  return [
    state.scene,
    state.time,
    state.summary,
    ...state.inventory,
    ...state.clues,
    ...state.npcs.map((n) => `${n.name} ${n.note}`),
  ].join(" ");
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Check one turn's state transition. Pure, so the whole rule set is unit-tested
 * and therefore covered by the ladder.
 *
 * Findings are ADVISORY. Nothing here rejects a turn, rewrites a state or
 * retries a call: a wrong finding must cost a line of text, never a turn the
 * player already played.
 */
export function checkContinuity(
  prev: GameState,
  next: GameState,
  ledger: StoryLedger,
  narration: string
): ContinuityFinding[] {
  const findings: ContinuityFinding[] = [];

  // 1. The GM's private notes reaching the prose the player reads. The type
  //    barrier (PlayerLedger has no hidden_state field) stops GM state being
  //    RENDERED as state; it cannot stop the GM narrating it.
  //
  //    This also fires when the story legitimately reveals the twist, and that
  //    is the intended behaviour rather than a false positive: once a secret is
  //    spoken it is no longer secret, and leaving it in hidden_state means the
  //    bookkeeping now disagrees with the story. Leak or stale note, both want
  //    the same fix, so both are worth a line.
  if (next.hidden_state && sharesPhrase(next.hidden_state, narration)) {
    findings.push({
      code: "hidden-state-in-narration",
      detail: "A run of words from the GM's private notes appears in the narration — either it leaked, or it has been revealed and should move out of hidden_state.",
    });
  }

  // 2. The same text copied into a player-visible FIELD. A distinct path from
  //    the one above and equally invisible to the type barrier, which polices
  //    the shape of the state object, not what the GM copies into it.
  if (next.hidden_state && sharesPhrase(next.hidden_state, publicText(next))) {
    findings.push({
      code: "hidden-state-in-state",
      detail: "A run of words from the GM's private notes appears in the player-visible state.",
    });
  }

  // 3. People do not vanish; they gain a note. Inventory loss is deliberately
  //    NOT a rule -- items get spent, dropped and stolen, so absence there is
  //    ordinary play rather than drift.
  const nextNames = new Set(next.npcs.map((n) => normalizeName(n.name)));
  for (const npc of prev.npcs) {
    const name = normalizeName(npc.name);
    if (name && !nextNames.has(name)) {
      findings.push({
        code: "npc-dropped",
        detail: `"${npc.name}" was in the cast last turn and is not in it now. Someone leaving the scene is a note on them, not a deletion.`,
      });
    }
  }

  // 4. Negative memory, enforced. A `ruled_out` row is the story saying a door
  //    is shut; this catches it being quietly re-opened as a fresh clue or
  //    item. Compared against what the turn ADDED, so a standing contradiction
  //    is reported on the turn that introduces it and not on every turn after.
  const before = new Set([...prev.clues, ...prev.inventory].map(normalizeName));
  const added = [...next.clues, ...next.inventory].filter((e) => !before.has(normalizeName(e)));
  if (added.length) {
    const addedText = added.join(" ");
    for (const row of ledger.rows) {
      if (row.kind !== "ruled_out") continue;
      if (sharesPhrase(row.text, addedText)) {
        findings.push({
          code: "ruled-out-resurfaced",
          detail: `Ledger row ${row.id} ruled this out, and this turn added it back.`,
        });
      }
    }
  }

  return findings;
}
