// @ts-check
/**
 * @import { ProviderId } from "../types"
 */
import React from "react";
import { ApiKeyRow } from "./ApiKeyRow.jsx";
import { LocalLLMRow } from "./LocalLLMRow.jsx";
import { PROVIDER_ORDER } from "../llm/providers";

/** No props. */
export function ApiKeysSection() {
  return (
    <div className="settings-toggle" style={{ cursor: "default", display: "block" }}>
      <div
        className="display-font"
        style={{ color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}
      >
        API keys
      </div>
      <div
        className="body-font italic"
        style={{ color: "var(--cream-dim)", fontSize: 12, marginTop: 4, lineHeight: 1.6 }}
      >
        Keys are stored only in this browser's localStorage and are never sent anywhere except the provider's own API.
      </div>
      {PROVIDER_ORDER.filter((id) => id !== "local").map((id) => (
        <ApiKeyRow key={id} providerId={/** @type {ProviderId} */ (id)} />
      ))}
      <LocalLLMRow />
    </div>
  );
}
