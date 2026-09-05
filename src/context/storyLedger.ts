import type { LedgerRow, LedgerRowInput, StoryLedger } from "../types";
import { LEDGER_MAX_ROWS, LEDGER_ROLLOVER_BATCH, LEDGER_ROW_CHAR_CAP } from "../data/constants";

// The story's permanent memory. Every function here returns a new ledger and
// none of them can reach an existing row's text: rollover moves a row into the
// chronicle verbatim, and nothing else touches one after it is written.

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

/**
 * Fold the oldest rows into the frozen chronicle until the live set is back
 * within LEDGER_MAX_ROWS. Rolls in batches so a long game folds a few times
 * rather than once per turn.
 */
function rollover(ledger: StoryLedger): StoryLedger {
  let { rows, chronicle, rolled } = ledger;
  while (rows.length > LEDGER_MAX_ROWS) {
    const batch = rows.slice(0, LEDGER_ROLLOVER_BATCH);
    if (!batch.length) break;
    const folded = batch.map((r) => r.text).join(" ");
    chronicle = chronicle ? `${chronicle} ${folded}` : folded;
    rows = rows.slice(batch.length);
    rolled += batch.length;
  }
  return { rows, chronicle, rolled };
}

/**
 * Append proposed rows. Ids and turn numbers are assigned here, never taken
 * from the caller.
 *
 * Three things are dropped or reshaped on the way in, and each one is a bound
 * on a tier the model both writes and reads:
 *   · blank text — nothing to remember;
 *   · a duplicate of a row already held or already folded into the chronicle,
 *     compared on normalized text. Without this a model that re-states the same
 *     fact each turn spends the whole cap on one sentence;
 *   · text over LEDGER_ROW_CHAR_CAP, truncated (see the constant for why this
 *     truncates where the repo's own ledger rejects).
 *
 * Ids continue across a rollover because they are derived from `rolled +
 * rows.length`, an odometer of everything ever appended rather than a count of
 * what is currently held.
 */
export function appendLedgerRows(
  ledger: StoryLedger,
  turn: number,
  inputs: readonly LedgerRowInput[]
): StoryLedger {
  if (!inputs.length) return ledger;

  const seen = new Set(ledger.rows.map((r) => normalize(r.text)));
  const chronicleText = normalize(ledger.chronicle);
  const added: LedgerRow[] = [];

  for (const input of inputs) {
    const text = input.text.trim();
    if (!text) continue;
    const key = normalize(text);
    if (seen.has(key)) continue;
    if (chronicleText.includes(key)) continue;
    seen.add(key);
    added.push({
      id: `L-${pad(ledger.rolled + ledger.rows.length + added.length + 1)}`,
      turn,
      kind: input.kind,
      text: text.length > LEDGER_ROW_CHAR_CAP ? text.slice(0, LEDGER_ROW_CHAR_CAP).trimEnd() : text,
    });
  }

  if (!added.length) return ledger;
  return rollover({ ...ledger, rows: [...ledger.rows, ...added] });
}

/**
 * A turn number derived from the transcript: one turn per user/assistant pair.
 * Defined once because two call sites need the same answer -- the append path
 * stamps rows with it and the undo path truncates against it -- and a drift
 * between them would silently misdate or over-delete rows.
 */
export function turnOf(history: readonly unknown[]): number {
  return Math.floor(history.length / 2);
}

/**
 * Drop rows stamped after `turn`. This is the ONE path that removes a row, and
 * it is reachable only from the player's undo.
 *
 * That is not a hole in append-only-ness, it is where the boundary sits: the GM
 * may never revise a row, and the player may unmake a turn that was never
 * played. Same split as the repo's own rule that pushed history is immutable to
 * an agent while the owner may still rewrite it.
 *
 * Known limit: rows already folded into the chronicle cannot come back, so an
 * undo reaching past a rollover leaves the folded text in place. Undo only ever
 * walks back one turn, and a rollover batch is LEDGER_ROLLOVER_BATCH turns wide
 * at minimum, so the case needs a rollover on the very turn being unmade.
 */
export function truncateLedgerToTurn(ledger: StoryLedger, turn: number): StoryLedger {
  const rows = ledger.rows.filter((r) => r.turn <= turn);
  if (rows.length === ledger.rows.length) return ledger;
  return { ...ledger, rows };
}

/**
 * The ledger as the prompt sees it. Kept here beside the data so the block's
 * shape and the rows' semantics stay in one file; src/llm/prompt.ts composes it
 * with the mutable state block.
 */
export function formatLedgerForPrompt(ledger: StoryLedger): string {
  if (!ledger.rows.length && !ledger.chronicle) return "";
  const lines = [
    "[STORY LEDGER — permanent. These facts are established and outrank anything",
    "in your own recollection. Never contradict a row; add to them instead.]",
  ];
  if (ledger.chronicle) lines.push(`Earlier: ${ledger.chronicle}`);
  for (const row of ledger.rows) {
    lines.push(`  ${row.id} [${row.kind === "ruled_out" ? "RULED OUT" : "established"}] ${row.text}`);
  }
  return lines.join("\n");
}
