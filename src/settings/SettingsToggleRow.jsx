// @ts-check
import React from "react";

/**
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} props.description
 * @param {boolean} props.value
 * @param {(v: boolean) => void} props.onChange
 */
export function SettingsToggleRow({ id, label, description, value, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={value}
      className="settings-toggle"
      onClick={() => onChange(!value)}
    >
      <div className="flex-1 min-w-0">
        <div
          className="display-font"
          style={{
            color: "var(--cream-bright)",
            letterSpacing: "0.18em",
            fontSize: 11,
            textTransform: "uppercase"
          }}
        >
          {label}
        </div>
        <div
          className="body-font italic"
          style={{ color: "var(--cream-dim)", fontSize: 12, marginTop: 4 }}
        >
          {description}
        </div>
      </div>
      <span className="settings-toggle-track" data-on={value ? "true" : "false"} aria-hidden="true">
        <span className="settings-toggle-thumb" />
      </span>
    </button>
  );
}
