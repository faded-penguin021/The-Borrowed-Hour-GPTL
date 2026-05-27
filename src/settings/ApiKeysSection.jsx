import React from "react";
import { ApiKeyRow } from "./ApiKeyRow.jsx";
import { LocalLLMRow } from "./LocalLLMRow.jsx";
import { PROVIDER_ORDER } from "../llm/providers.js";

export function ApiKeysSection() {
  return /* @__PURE__ */ React.createElement("div", {
    className: "settings-toggle",
    style: { cursor: "default", display: "block" }
  },
    /* @__PURE__ */ React.createElement("div", {
      className: "display-font",
      style: { color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }
    }, "API keys"),
    /* @__PURE__ */ React.createElement("div", {
      className: "body-font italic",
      style: { color: "var(--cream-dim)", fontSize: 12, marginTop: 4, lineHeight: 1.6 }
    }, "Keys are stored only in this browser's localStorage and are never sent anywhere except the provider's own API."),
    PROVIDER_ORDER.filter((id) => id !== "local").map((id) => /* @__PURE__ */ React.createElement(ApiKeyRow, { key: id, providerId: id })),
    /* @__PURE__ */ React.createElement(LocalLLMRow, null)
  );
}
