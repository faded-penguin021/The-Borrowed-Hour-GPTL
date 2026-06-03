import React from "react";
import type { PlayerLedger, Premise } from "../../types";
import { realmText } from "../../data/realmStyles";
import { Modal } from "../ui/Modal";
import { X } from "lucide-react";

interface LedgerModalProps {
  premise: Premise;
  // PlayerLedger, not GameState: the modal structurally cannot receive
  // hidden_state. Callers project via `toPlayerLedger` at the render boundary.
  ledger: PlayerLedger;
  onClose: () => void;
}

export function LedgerModal({ premise, ledger, onClose }: LedgerModalProps) {
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
        </div>
    </Modal>
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
