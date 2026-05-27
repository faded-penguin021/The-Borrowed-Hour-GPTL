import React, { useState, useEffect } from "react";
import { SAVE_CAP, APPROX_CHARS_PER_TOKEN, formatKB, formatTokens } from "../../data/constants.js";
import { realmGlyph } from "../../data/premises.js";

export function SavesModal({ saves, totalBytes = 0, cap = SAVE_CAP, loading, onClose, onLoad, onDelete, inGame }) {
  const [armedKey, setArmedKey] = useState(null);
  useEffect(() => {
    if (!armedKey)
      return;
    const t = setTimeout(() => setArmedKey(null), 4000);
    return () => clearTimeout(t);
  }, [armedKey]);
  const handleReleaseTap = (key, e) => {
    e.stopPropagation();
    if (armedKey === key) {
      setArmedKey(null);
      onDelete(key, e);
    } else {
      setArmedKey(key);
    }
  };
  const ratio = saves.length / cap;
  const countTone = saves.length >= cap ? "full" : ratio >= 0.8 ? "warn" : "ok";
  const countColor = countTone === "full" ? "var(--rose-ember)" : countTone === "warn" ? "var(--rose-gold)" : "var(--cream-dim)";
  const totalKB = totalBytes / 1024;
  return /* @__PURE__ */ React.createElement("div", {
    className: "modal-backdrop",
    onClick: () => {
      setArmedKey(null);
      onClose();
    }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "modal-panel",
    onClick: (e) => {
      setArmedKey(null);
      e.stopPropagation();
    }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "px-6 py-5 border-b flex items-center justify-between",
    style: { borderColor: "rgba(232, 222, 197, 0.1)" }
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", {
    className: "display-font text-[10px] mb-1",
    style: { color: "var(--cream-faint)", letterSpacing: "0.4em" }
  }, "HOURS SET ASIDE"), /* @__PURE__ */ React.createElement("h2", {
    className: "display-font text-xl",
    style: { color: "var(--cream-bright)", letterSpacing: "0.04em" }
  }, "Take an hour up again"), !loading && saves.length > 0 && /* @__PURE__ */ React.createElement("div", {
    className: "body-font italic mt-1 flex flex-wrap gap-x-3",
    style: { fontSize: 12, color: "var(--cream-dim)" }
  }, /* @__PURE__ */ React.createElement("span", {
    style: { color: countColor }
  }, saves.length, " of ", cap, " kept", countTone === "full" && " — full", countTone === "warn" && " — nearing the cap"), /* @__PURE__ */ React.createElement("span", null, "·"), /* @__PURE__ */ React.createElement("span", null, formatKB(totalKB), " in total"), /* @__PURE__ */ React.createElement("span", null, "·"), /* @__PURE__ */ React.createElement("span", null, formatTokens(Math.round(totalBytes / APPROX_CHARS_PER_TOKEN))))), /* @__PURE__ */ React.createElement("button", {
    onClick: onClose,
    className: "display-font text-sm",
    style: { color: "var(--cream-dim)", letterSpacing: "0.2em" },
    "aria-label": "Close"
  }, "✕")), /* @__PURE__ */ React.createElement("div", {
    className: "overflow-y-auto px-6 py-5 space-y-3",
    style: { minHeight: 200 }
  }, loading ? /* @__PURE__ */ React.createElement("div", {
    className: "text-center body-font italic py-12",
    style: { color: "var(--cream-dim)" }
  }, "Counting the hours", /* @__PURE__ */ React.createElement("span", {
    className: "typing-dots"
  }, /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, "."), /* @__PURE__ */ React.createElement("span", null, "."))) : saves.length === 0 ? /* @__PURE__ */ React.createElement("div", {
    className: "text-center body-font italic py-12",
    style: { color: "var(--cream-faint)" }
  }, "No hours set aside yet.", inGame && /* @__PURE__ */ React.createElement("div", {
    className: "mt-2 text-sm"
  }, "Use ❀ SET ASIDE to keep your current hour.")) : saves.map((save) => /* @__PURE__ */ React.createElement("button", {
    key: save.key,
    className: "save-row",
    onClick: () => onLoad(save)
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex items-center gap-2 mb-1 flex-wrap"
  }, /* @__PURE__ */ React.createElement("span", {
    className: `realm-pill realm-${save.realm}`,
    style: { fontSize: 8, padding: "2px 7px" }
  }, realmGlyph(save.realm), " ", save.realmLabel || save.realm?.toUpperCase()), /* @__PURE__ */ React.createElement("span", {
    className: "display-font text-base",
    style: { color: "var(--cream-bright)", letterSpacing: "0.02em" }
  }, save.title)), /* @__PURE__ */ React.createElement("div", {
    className: "body-font italic text-sm flex flex-wrap gap-x-3 items-center",
    style: { color: "var(--cream-dim)" }
  }, /* @__PURE__ */ React.createElement("span", null, save.turns || 0, " turns taken"), /* @__PURE__ */ React.createElement("span", null, "·"), /* @__PURE__ */ React.createElement("span", null, formatRelative(save.savedAt)), save.size && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "·"), /* @__PURE__ */ React.createElement("span", {
    title: `${formatKB(save.size.kb)} on disk · ${formatTokens(save.size.tokens)} if reloaded`,
    style: { color: "var(--cream-faint)" }
  }, formatKB(save.size.kb), " · ", formatTokens(save.size.tokens))), save.ended && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "·"), /* @__PURE__ */ React.createElement("span", {
    className: "display-font",
    style: {
      color: "var(--rose-gold)",
      fontSize: 9,
      letterSpacing: "0.3em"
    }
  }, "❦ COMPLETE")))), /* @__PURE__ */ React.createElement("span", {
    onClick: (e) => handleReleaseTap(save.key, e),
    className: "icon-btn icon-btn-danger",
    style: {
      padding: "5px 10px",
      fontSize: 9,
      background: armedKey === save.key ? "rgba(180, 70, 70, 0.25)" : undefined,
      borderColor: armedKey === save.key ? "rgba(220, 100, 100, 0.7)" : undefined,
      color: armedKey === save.key ? "rgba(255, 200, 200, 1)" : undefined
    },
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ")
        handleReleaseTap(save.key, e);
    },
    title: armedKey === save.key ? "Tap again to release this hour permanently" : "Release this hour (tap, then confirm)",
    "aria-label": armedKey === save.key ? `Confirm releasing ${save.title}` : `Release ${save.title}`
  }, armedKey === save.key ? "✕ CONFIRM" : "RELEASE"))))));
}
function formatRelative(ts) {
  if (!ts)
    return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)
    return "moments ago";
  if (m < 60)
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24)
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30)
    return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}
