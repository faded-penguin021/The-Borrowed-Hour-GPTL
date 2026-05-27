import React from "react";

export function LedgerModal({ premise, gameState, onClose }) {
  const realmColor = `var(--${premise.realm})`;
  const has = (a) => Array.isArray(a) && a.length > 0;
  const empty = !gameState || !gameState.scene && !gameState.time && !has(gameState.inventory) && !has(gameState.npcs) && !has(gameState.clues) && !gameState.summary;
  return /* @__PURE__ */ React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /* @__PURE__ */ React.createElement("div", {
    className: "modal-panel",
    onClick: (e) => e.stopPropagation()
  }, /* @__PURE__ */ React.createElement("div", {
    className: "px-6 py-5 border-b flex items-center justify-between",
    style: { borderColor: "rgba(232, 222, 197, 0.1)" }
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", {
    className: "display-font text-[10px] mb-1",
    style: { color: "var(--cream-faint)", letterSpacing: "0.4em" }
  }, "WHAT IS KEPT IN THE LEDGER"), /* @__PURE__ */ React.createElement("h2", {
    className: "display-font text-xl",
    style: { color: "var(--cream-bright)", letterSpacing: "0.04em" }
  }, "The current state of your hour")), /* @__PURE__ */ React.createElement("button", {
    onClick: onClose,
    className: "display-font text-sm",
    style: { color: "var(--cream-dim)", letterSpacing: "0.2em" }
  }, "✕")), /* @__PURE__ */ React.createElement("div", {
    className: "overflow-y-auto px-6 py-5 space-y-5"
  }, empty ? /* @__PURE__ */ React.createElement("div", {
    className: "text-center body-font italic py-8",
    style: { color: "var(--cream-faint)" }
  }, "The ledger is still blank. Take an action to fill it.") : /* @__PURE__ */ React.createElement(React.Fragment, null, (gameState.scene || gameState.time) && /* @__PURE__ */ React.createElement(LedgerBlock, {
    label: "WHERE / WHEN",
    color: realmColor
  }, gameState.scene && /* @__PURE__ */ React.createElement("div", {
    style: { color: "var(--cream-bright)" }
  }, gameState.scene), gameState.time && /* @__PURE__ */ React.createElement("div", {
    className: "italic mt-1",
    style: { color: "var(--cream-dim)" }
  }, gameState.time)), has(gameState.inventory) && /* @__PURE__ */ React.createElement(LedgerBlock, {
    label: "ON YOUR PERSON",
    color: realmColor
  }, /* @__PURE__ */ React.createElement("ul", {
    className: "space-y-1"
  }, gameState.inventory.map((it, i) => /* @__PURE__ */ React.createElement("li", {
    key: i,
    style: { color: "var(--cream)" }
  }, "— ", it)))), has(gameState.npcs) && /* @__PURE__ */ React.createElement(LedgerBlock, {
    label: "ENCOUNTERED",
    color: realmColor
  }, /* @__PURE__ */ React.createElement("ul", {
    className: "space-y-2"
  }, gameState.npcs.map((n, i) => /* @__PURE__ */ React.createElement("li", {
    key: i
  }, /* @__PURE__ */ React.createElement("span", {
    className: "display-font",
    style: {
      color: "var(--cream-bright)",
      letterSpacing: "0.04em",
      fontSize: "14px"
    }
  }, n.name), n.note && /* @__PURE__ */ React.createElement("span", {
    className: "italic",
    style: { color: "var(--cream-dim)" }
  }, " ", "— ", n.note))))), has(gameState.clues) && /* @__PURE__ */ React.createElement(LedgerBlock, {
    label: "WHAT YOU KNOW",
    color: realmColor
  }, /* @__PURE__ */ React.createElement("ul", {
    className: "space-y-1"
  }, gameState.clues.map((c, i) => /* @__PURE__ */ React.createElement("li", {
    key: i,
    style: { color: "var(--cream)" }
  }, "— ", c)))), gameState.summary && /* @__PURE__ */ React.createElement(LedgerBlock, {
    label: "THE STORY SO FAR",
    color: realmColor
  }, /* @__PURE__ */ React.createElement("div", {
    className: "italic",
    style: { color: "var(--cream)", lineHeight: 1.6 }
  }, gameState.summary))))));
}
export function LedgerBlock({ label, color, children }) {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", {
    className: "display-font mb-2",
    style: {
      color: color || "var(--cream-faint)",
      letterSpacing: "0.35em",
      fontSize: "10px"
    }
  }, "❦ ", label), /* @__PURE__ */ React.createElement("div", {
    className: "body-font text-base",
    style: { lineHeight: 1.6 }
  }, children));
}
