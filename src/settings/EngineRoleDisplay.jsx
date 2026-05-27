import React from "react";
import { PROVIDER_META } from "../llm/providers.js";

export function EngineRoleDisplay({ label, engine }) {
  const providerName = PROVIDER_META[engine?.provider]?.name || engine?.provider || "—";
  const model = engine?.model || "—";
  const fieldStyle = {
    width: "100%",
    marginTop: 6,
    padding: "7px 9px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid rgba(232,222,197,0.12)",
    background: "rgba(22,18,21,0.5)",
    color: "var(--cream-dim)",
    fontFamily: "inherit",
    letterSpacing: "0.02em"
  };
  return /* @__PURE__ */ React.createElement("div", {
    style: { marginTop: 14 }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "display-font",
    style: { color: "var(--cream-dim)", letterSpacing: "0.16em", fontSize: 10, textTransform: "uppercase" }
  }, label), /* @__PURE__ */ React.createElement("div", {
    style: { ...fieldStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }
  }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--cream-faint)" } }, providerName), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--cream-dim)" } }, model)));
}
