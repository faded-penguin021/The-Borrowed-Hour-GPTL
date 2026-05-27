import React from "react";

export function SettingsToggleRow({ id, label, description, value, onChange }) {
  return /* @__PURE__ */ React.createElement("button", {
    id,
    type: "button",
    role: "switch",
    "aria-checked": value,
    className: "settings-toggle",
    onClick: () => onChange(!value)
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "display-font",
    style: {
      color: "var(--cream-bright)",
      letterSpacing: "0.18em",
      fontSize: 11,
      textTransform: "uppercase"
    }
  }, label), /* @__PURE__ */ React.createElement("div", {
    className: "body-font italic",
    style: { color: "var(--cream-dim)", fontSize: 12, marginTop: 4 }
  }, description)), /* @__PURE__ */ React.createElement("span", {
    className: "settings-toggle-track",
    "data-on": value ? "true" : "false",
    "aria-hidden": "true"
  }, /* @__PURE__ */ React.createElement("span", {
    className: "settings-toggle-thumb"
  })));
}
