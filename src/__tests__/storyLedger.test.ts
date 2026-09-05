import { describe, it, expect } from "vitest";
import {
  appendLedgerRows, formatLedgerForPrompt, truncateLedgerToTurn, turnOf,
} from "../context/storyLedger";
import {
  EMPTY_LEDGER, LEDGER_MAX_ROWS, LEDGER_ROLLOVER_BATCH, LEDGER_ROW_CHAR_CAP,
} from "../data/constants";
import type { LedgerRowInput, StoryLedger } from "../types";

const est = (text: string): LedgerRowInput => ({ kind: "established", text });

// Fill a ledger with n distinct rows, all stamped turn 1.
const filled = (n: number): StoryLedger =>
  appendLedgerRows(EMPTY_LEDGER, 1, Array.from({ length: n }, (_, i) => est(`fact ${i}`)));

describe("appendLedgerRows", () => {
  it("assigns sequential ids and stamps the turn", () => {
    const l = appendLedgerRows(EMPTY_LEDGER, 3, [est("the door is locked"), est("Ada lied")]);
    expect(l.rows.map((r) => r.id)).toEqual(["L-001", "L-002"]);
    expect(l.rows.every((r) => r.turn === 3)).toBe(true);
  });

  it("ignores an id or turn the caller tries to supply", () => {
    // The model proposes text and kind only; anything else is assigned here.
    const rogue = { kind: "established", text: "planted", id: "L-999", turn: 42 } as LedgerRowInput;
    const l = appendLedgerRows(EMPTY_LEDGER, 5, [rogue]);
    expect(l.rows[0].id).toBe("L-001");
    expect(l.rows[0].turn).toBe(5);
  });

  it("drops blank and whitespace-only rows", () => {
    const l = appendLedgerRows(EMPTY_LEDGER, 1, [est("  "), est(""), est("real")]);
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0].text).toBe("real");
  });

  it("drops a duplicate of a row already held, ignoring case and spacing", () => {
    const first = appendLedgerRows(EMPTY_LEDGER, 1, [est("The vault is sealed")]);
    const second = appendLedgerRows(first, 2, [est("  the   VAULT is sealed ")]);
    expect(second.rows).toHaveLength(1);
    expect(second).toBe(first); // unchanged ledgers are returned by identity
  });

  it("drops a duplicate within a single append", () => {
    const l = appendLedgerRows(EMPTY_LEDGER, 1, [est("same"), est("SAME")]);
    expect(l.rows).toHaveLength(1);
  });

  it("truncates a row over the char cap instead of dropping the fact", () => {
    const long = "x".repeat(LEDGER_ROW_CHAR_CAP + 50);
    const l = appendLedgerRows(EMPTY_LEDGER, 1, [est(long)]);
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0].text).toHaveLength(LEDGER_ROW_CHAR_CAP);
  });

  it("returns the same ledger when nothing survives filtering", () => {
    const before = filled(2);
    expect(appendLedgerRows(before, 2, [est("")])).toBe(before);
    expect(appendLedgerRows(before, 2, [])).toBe(before);
  });

  it("never mutates the ledger it was given", () => {
    const before = filled(3);
    const snapshot = JSON.parse(JSON.stringify(before));
    appendLedgerRows(before, 2, [est("new fact")]);
    expect(before).toEqual(snapshot);
  });
});

describe("rollover", () => {
  it("does not roll while at or below the cap", () => {
    const l = filled(LEDGER_MAX_ROWS);
    expect(l.rows).toHaveLength(LEDGER_MAX_ROWS);
    expect(l.chronicle).toBe("");
    expect(l.rolled).toBe(0);
  });

  it("folds the oldest batch into the chronicle once the cap is passed", () => {
    const l = filled(LEDGER_MAX_ROWS + 1);
    expect(l.rolled).toBe(LEDGER_ROLLOVER_BATCH);
    expect(l.rows).toHaveLength(LEDGER_MAX_ROWS + 1 - LEDGER_ROLLOVER_BATCH);
    // The folded text survives verbatim -- rollover is not deletion.
    expect(l.chronicle).toContain("fact 0");
    expect(l.chronicle).toContain(`fact ${LEDGER_ROLLOVER_BATCH - 1}`);
    // ...and the rows it folded are gone from the live set.
    expect(l.rows.some((r) => r.text === "fact 0")).toBe(false);
  });

  it("keeps ids monotonic across a rollover", () => {
    const l = filled(LEDGER_MAX_ROWS + 1);
    const ids = l.rows.map((r) => Number(r.id.slice(2)));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    // First surviving id continues from what was folded, it does not restart.
    expect(ids[0]).toBe(LEDGER_ROLLOVER_BATCH + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("continues ids on the append AFTER a rollover, without colliding", () => {
    // The case the previous test cannot reach: within one append, rollover runs
    // only after every id is assigned, so `rolled` is still 0 and an id scheme
    // that ignored the odometer would look identical. It is the NEXT append
    // that reveals the difference -- and gets it wrong by reusing a live id.
    const rolled = filled(LEDGER_MAX_ROWS + 1);
    const after = appendLedgerRows(rolled, 2, [est("written after the fold")]);
    const fresh = after.rows[after.rows.length - 1];

    expect(fresh.text).toBe("written after the fold");
    expect(Number(fresh.id.slice(2))).toBe(LEDGER_MAX_ROWS + 2);
    expect(after.rows.filter((r) => r.id === fresh.id)).toHaveLength(1);
    expect(new Set(after.rows.map((r) => r.id)).size).toBe(after.rows.length);
  });

  it("appends to an existing chronicle rather than replacing it", () => {
    const once = filled(LEDGER_MAX_ROWS + 1);
    const twice = appendLedgerRows(
      once, 2,
      Array.from({ length: LEDGER_ROLLOVER_BATCH }, (_, i) => est(`later ${i}`)),
    );
    expect(twice.chronicle.startsWith(once.chronicle)).toBe(true);
    expect(twice.rolled).toBeGreaterThan(once.rolled);
  });

  it("will not re-append a fact already folded into the chronicle", () => {
    const l = filled(LEDGER_MAX_ROWS + 1);
    const retry = appendLedgerRows(l, 9, [est("fact 0")]);
    expect(retry).toBe(l);
  });
});

describe("truncateLedgerToTurn", () => {
  it("drops rows stamped after the surviving turn", () => {
    let l = appendLedgerRows(EMPTY_LEDGER, 1, [est("turn one")]);
    l = appendLedgerRows(l, 2, [est("turn two")]);
    const undone = truncateLedgerToTurn(l, 1);
    expect(undone.rows.map((r) => r.text)).toEqual(["turn one"]);
  });

  it("keeps rows stamped on the surviving turn itself", () => {
    const l = appendLedgerRows(EMPTY_LEDGER, 2, [est("kept")]);
    expect(truncateLedgerToTurn(l, 2).rows).toHaveLength(1);
  });

  it("returns the same ledger when nothing is dropped", () => {
    const l = filled(2);
    expect(truncateLedgerToTurn(l, 99)).toBe(l);
  });

  it("leaves the chronicle alone -- folded rows do not come back", () => {
    const l = filled(LEDGER_MAX_ROWS + 1);
    const undone = truncateLedgerToTurn(l, 0);
    expect(undone.rows).toHaveLength(0);
    expect(undone.chronicle).toBe(l.chronicle);
    expect(undone.rolled).toBe(l.rolled);
  });
});

describe("turnOf", () => {
  it("counts one turn per user/assistant pair", () => {
    expect(turnOf([])).toBe(0);
    expect(turnOf([1, 2])).toBe(1);
    expect(turnOf([1, 2, 3, 4])).toBe(2);
  });

  it("does not advance on a half-finished turn", () => {
    expect(turnOf([1, 2, 3])).toBe(1);
  });
});

describe("formatLedgerForPrompt", () => {
  it("is empty for an empty ledger, so no block is injected", () => {
    expect(formatLedgerForPrompt(EMPTY_LEDGER)).toBe("");
  });

  it("marks a ruled-out row differently from an established one", () => {
    const l = appendLedgerRows(EMPTY_LEDGER, 1, [
      est("the bridge stands"),
      { kind: "ruled_out", text: "the abbot is the killer" },
    ]);
    const block = formatLedgerForPrompt(l);
    expect(block).toContain("[established] the bridge stands");
    expect(block).toContain("[RULED OUT] the abbot is the killer");
  });

  it("includes the chronicle when rows have rolled over", () => {
    const block = formatLedgerForPrompt(filled(LEDGER_MAX_ROWS + 1));
    expect(block).toContain("Earlier:");
    expect(block).toContain("fact 0");
  });
});
