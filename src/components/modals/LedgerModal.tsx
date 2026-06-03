import React from "react";
import type { PlayerLedger, Premise } from "../../types";
import { X } from "lucide-react";

interface LedgerModalProps {
  premise: Premise;
  // PlayerLedger, not GameState: the modal structurally cannot receive
  // hidden_state. Callers project via `toPlayerLedger` at the render boundary.
  ledger: PlayerLedger;
  onClose: () => void;
}

export function LedgerModal({ premise, ledger, onClose }: LedgerModalProps) {
  const realmColor = `var(--${premise.realm})`;
  const has = (a: unknown) => Array.isArray(a) && a.length > 0;
  const empty = !ledger || !ledger.scene && !ledger.time && !has(ledger.inventory) && !has(ledger.npcs) && !has(ledger.clues) && !ledger.summary;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <div>
            <div
              className="display-font text-[10px] mb-1"
              style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
            >
              WHAT IS KEPT IN THE LEDGER
            </div>
            <h2
              className="display-font text-xl"
              style={{ color: "var(--cream-bright)", letterSpacing: "0.04em" }}
            >
              The current state of your hour
            </h2>
          </div>
          <button
            onClick={onClose}
            className="display-font text-sm"
            style={{ color: "var(--cream-dim)", letterSpacing: "0.2em" }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {empty ? (
            <div
              className="text-center body-font italic py-8"
              style={{ color: "var(--cream-faint)" }}
            >
              The ledger is still blank. Take an action to fill it.
            </div>
          ) : (
            <>
              {(ledger.scene || ledger.time) && (
                <LedgerBlock label="WHERE / WHEN" color={realmColor}>
                  {ledger.scene && <div style={{ color: "var(--cream-bright)" }}>{ledger.scene}</div>}
                  {ledger.time && (
                    <div className="italic mt-1" style={{ color: "var(--cream-dim)" }}>{ledger.time}</div>
                  )}
                </LedgerBlock>
              )}
              {has(ledger.inventory) && (
                <LedgerBlock label="ON YOUR PERSON" color={realmColor}>
                  <ul className="space-y-1">
                    {ledger.inventory.map((it, i) => (
                      <li key={i} style={{ color: "var(--cream)" }}>— {it}</li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {has(ledger.npcs) && (
                <LedgerBlock label="ENCOUNTERED" color={realmColor}>
                  <ul className="space-y-2">
                    {ledger.npcs.map((n, i) => (
                      <li key={i}>
                        <span
                          className="display-font"
                          style={{
                            color: "var(--cream-bright)",
                            letterSpacing: "0.04em",
                            fontSize: "14px"
                          }}
                        >
                          {n.name}
                        </span>
                        {n.note && (
                          <span className="italic" style={{ color: "var(--cream-dim)" }}>
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
                      <li key={i} style={{ color: "var(--cream)" }}>— {c}</li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {ledger.summary && (
                <LedgerBlock label="THE STORY SO FAR" color={realmColor}>
                  <div className="italic" style={{ color: "var(--cream)", lineHeight: 1.6 }}>
                    {ledger.summary}
                  </div>
                </LedgerBlock>
              )}
            </>
          )}
        </div>
      </div>
    </div>
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
      <div
        className="display-font mb-2"
        style={{
          color: color || "var(--cream-faint)",
          letterSpacing: "0.35em",
          fontSize: "10px"
        }}
      >
        <span className="divider-ornament-inline">{label}</span>
      </div>
      <div className="body-font text-base" style={{ lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
