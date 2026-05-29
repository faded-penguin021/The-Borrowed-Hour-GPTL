// @ts-check
import React from "react";
import { PROVIDER_META } from "../llm/providers.js";

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {EngineConfig} props.engine
 */
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
  return (
    <div style={{ marginTop: 14 }}>
      <div
        className="display-font"
        style={{ color: "var(--cream-dim)", letterSpacing: "0.16em", fontSize: 10, textTransform: "uppercase" }}
      >
        {label}
      </div>
      <div style={{ ...fieldStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--cream-faint)" }}>{providerName}</span>
        <span style={{ color: "var(--cream-dim)" }}>{model}</span>
      </div>
    </div>
  );
}
