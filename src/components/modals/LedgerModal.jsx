// @ts-check
import React from "react";

/**
 * @param {Object} props
 * @param {Premise} props.premise
 * @param {GameState} props.gameState
 * @param {() => void} props.onClose
 */
export function LedgerModal({ premise, gameState, onClose }) {
  const realmColor = `var(--${premise.realm})`;
  const has = (/** @type {unknown} */ a) => Array.isArray(a) && a.length > 0;
  const empty = !gameState || !gameState.scene && !gameState.time && !has(gameState.inventory) && !has(gameState.npcs) && !has(gameState.clues) && !gameState.summary;
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
            ✕
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
              {(gameState.scene || gameState.time) && (
                <LedgerBlock label="WHERE / WHEN" color={realmColor}>
                  {gameState.scene && <div style={{ color: "var(--cream-bright)" }}>{gameState.scene}</div>}
                  {gameState.time && (
                    <div className="italic mt-1" style={{ color: "var(--cream-dim)" }}>{gameState.time}</div>
                  )}
                </LedgerBlock>
              )}
              {has(gameState.inventory) && (
                <LedgerBlock label="ON YOUR PERSON" color={realmColor}>
                  <ul className="space-y-1">
                    {gameState.inventory.map((it, i) => (
                      <li key={i} style={{ color: "var(--cream)" }}>— {it}</li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {has(gameState.npcs) && (
                <LedgerBlock label="ENCOUNTERED" color={realmColor}>
                  <ul className="space-y-2">
                    {gameState.npcs.map((n, i) => (
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
              {has(gameState.clues) && (
                <LedgerBlock label="WHAT YOU KNOW" color={realmColor}>
                  <ul className="space-y-1">
                    {gameState.clues.map((c, i) => (
                      <li key={i} style={{ color: "var(--cream)" }}>— {c}</li>
                    ))}
                  </ul>
                </LedgerBlock>
              )}
              {gameState.summary && (
                <LedgerBlock label="THE STORY SO FAR" color={realmColor}>
                  <div className="italic" style={{ color: "var(--cream)", lineHeight: 1.6 }}>
                    {gameState.summary}
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

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {string} [props.color]
 * @param {React.ReactNode} props.children
 */
export function LedgerBlock({ label, color, children }) {
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
        ❦ {label}
      </div>
      <div className="body-font text-base" style={{ lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
