import React, { useEffect, useState } from "react";
import type { ContinuityFinding, PlayerLedger, Premise } from "../../types";
import { realmText } from "../../data/realmStyles";
import { Modal } from "../ui/Modal";
import { X } from "lucide-react";

interface LedgerModalProps {
  premise: Premise;
  // PlayerLedger, not GameState: the modal structurally cannot receive
  // hidden_state. Callers project via `toPlayerLedger` at the render boundary.
  ledger: PlayerLedger;
  // Advisory findings from the last turn, already projected to their player
  // voice (`note`). Empty on an ordinary turn, which is most turns.
  findings?: ContinuityFinding[];
  onClose: () => void;
}

export function LedgerModal({ premise, ledger, findings = [], onClose }: LedgerModalProps) {
  const realmColor = realmText[premise.realm];
  const has = (a: unknown) => Array.isArray(a) && a.length > 0;
  const empty = !ledger || !ledger.scene && !ledger.time && !has(ledger.inventory) && !has(ledger.npcs) && !has(ledger.clues) && !ledger.summary;
  return (
    <Modal onClose={onClose}>
        <div className="px-6 py-5 border-b border-cream/10 flex items-center justify-between">
          <div>
            <div className="font-display font-medium text-[10px] mb-1 text-cream-faint tracking-[0.4em]">
              WHAT IS KEPT IN THE LEDGER
            </div>
            <h2 className="font-display font-medium text-xl text-cream-bright tracking-[0.04em]">
              The current state of your hour
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close the ledger"
            className="font-display font-medium text-sm text-cream-dim tracking-[0.2em]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {empty ? (
            <div className="text-center font-body italic py-8 text-cream-faint">
              The ledger is still blank. Take an action to fill it.
            </div>
          ) : (
            <>
              {(ledger.scene || ledger.time) && (
                <LedgerBlock label="WHERE / WHEN" color={realmColor}>
                  {ledger.scene && <div className="text-cream-bright">{ledger.scene}</div>}
                  {ledger.time && (
                    <div className="italic mt-1 text-cream-dim">{ledger.time}</div>
                  )}
                </LedgerBlock>
              )}
              {has(ledger.inventory) && (
                <LedgerBlock label="ON YOUR PERSON" color={realmColor}>
                  <ul className="space-y-1">
                    {ledger.inventory.map((it, i) => (
                      <li key={i} className="text-cream">— {it}</li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {has(ledger.npcs) && (
                <LedgerBlock label="ENCOUNTERED" color={realmColor}>
                  <ul className="space-y-2">
                    {ledger.npcs.map((n, i) => (
                      <li key={i}>
                        <span className="font-display font-medium text-cream-bright tracking-[0.04em] text-[14px]">
                          {n.name}
                        </span>
                        {n.note && (
                          <span className="italic text-cream-dim">
                            {" "}— {n.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {has(ledger.clues) && (
                <LedgerBlock label="WHAT YOU KNOW" color={realmColor}>
                  <ul className="space-y-1">
                    {ledger.clues.map((c, i) => (
                      <li key={i} className="text-cream">— {c}</li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {ledger.summary && (
                <LedgerBlock label="THE STORY SO FAR" color={realmColor}>
                  <div className="italic text-cream leading-[1.6]">
                    {ledger.summary}
                  </div>
                </LedgerBlock>
              )}
            </>
          )}
          <MarginNotes findings={findings} color={realmColor} />
        </div>
    </Modal>
  );
}

/**
 * The continuity findings, and the only place a player meets them.
 *
 * Two properties are the whole design, and both are deliberate:
 *
 * 1. **It is silent until opened.** No badge on the ledger button, no count in
 *    the header, nothing outside this modal. A finding can point straight at a
 *    spoiler -- "something added this turn was ruled out earlier" tells you the
 *    clue you just found is a dead end -- so the player has to reach for it
 *    twice, once to open the ledger and once to unfold this. A notice that
 *    announces itself would spend the spoiler on a player who never asked.
 * 2. **It renders `note`, never `detail`.** `detail` names `hidden_state` and
 *    story-ledger row ids: a memory tier the player is not shown at all.
 *
 * Advisory throughout -- nothing here changes the story. The rules report; the
 * player decides whether the hour still hangs together.
 */
function MarginNotes({ findings, color }: { findings: ContinuityFinding[]; color?: string }) {
  const [open, setOpen] = useState(false);

  // Re-fold whenever a new turn's verdict arrives. `SET_CONTINUITY` dispatches a
  // fresh array every turn, so reference identity IS "these are new findings".
  //
  // Without this the fold is one-way for the life of the modal: the ledger stays
  // openable mid-turn, so a player who unfolds turn N's note and leaves the modal
  // up is shown turn N+1's already unfolded -- reaching once for a surface whose
  // whole point is that you reach twice. An intervening clean turn does not save
  // it either: an empty `findings` renders nothing but does not unmount this.
  useEffect(() => { setOpen(false); }, [findings]);

  if (findings.length === 0) return null;
  const summary = findings.length === 1
    ? "One note was left in the margin this turn."
    : `${findings.length} notes were left in the margin this turn.`;
  return (
    <LedgerBlock label="IN THE MARGIN" color={color}>
      {/* The button stays mounted in both states: it carries the disclosure's
          `aria-expanded`, which nothing would announce if it were swapped out
          for the list, and it is the only way back to folded. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="margin-notes"
        className="italic text-left text-cream-faint hover:text-cream-dim"
      >
        {summary}
        {open ? "" : " They may tell you more about the story than it has told you. Read them?"}
      </button>
      {/* Rendered only when unfolded, not merely hidden: a folded note that sits
          in the DOM is a spoiler one devtools pane away. */}
      {open && (
        <ul id="margin-notes" className="space-y-2 mt-2">
          {findings.map((f, i) => (
            <li key={i} className="italic text-cream-dim">— {f.note}</li>
          ))}
        </ul>
      )}
    </LedgerBlock>
  );
}

interface LedgerBlockProps {
  label: string;
  color?: string;
  children: React.ReactNode;
}

export function LedgerBlock({ label, color, children }: LedgerBlockProps) {
  return (
    <div>
      <div className={`font-display font-medium mb-2 tracking-[0.35em] text-[10px] ${color || "text-cream-faint"}`}>
        <span className="divider-ornament-inline">{label}</span>
      </div>
      <div className="font-body text-base leading-[1.6]">
        {children}
      </div>
    </div>
  );
}
