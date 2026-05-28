import React from "react";

const fieldStyle = {
  width: "100%",
  marginTop: 6,
  padding: "7px 9px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid rgba(232,222,197,0.22)",
  background: "rgba(22,18,21,0.9)",
  color: "var(--cream-bright)"
};

// Preset-dropdown + Custom… + freeform text input.
// presets: { id, tier? }[]  value: current model ID  onChange: (id) => void
// When presets is empty the component renders only the freeform input.
export function ModelPicker({ label, presets = [], value, onChange }) {
  const hasPresets = presets.length > 0;
  const isCustom = hasPresets && !presets.some((m) => m.id === value);
  const subLabel = {
    color: "var(--cream-dim)", letterSpacing: "0.16em", fontSize: 10,
    textTransform: "uppercase", marginTop: 14
  };

  return (
    <>
      {label && <div style={subLabel}>{label}</div>}
      {hasPresets && (
        <select
          value={isCustom ? "__custom__" : (value || "")}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "__custom__" ? "" : v);
          }}
          style={fieldStyle}
        >
          {presets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.tier ? `${m.id} · ${m.tier}` : m.id}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
      )}
      {(!hasPresets || isCustom) && (
        <input
          type="text"
          value={value || ""}
          placeholder="Enter a model ID"
          onChange={(e) => onChange(e.target.value)}
          style={fieldStyle}
        />
      )}
    </>
  );
}
