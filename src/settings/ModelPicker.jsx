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
  const inPresets = hasPresets && presets.some((m) => m.id === value);

  // Local flag: tracks whether the user has explicitly chosen "Custom…"
  // from the dropdown. Without this, selecting Custom… calls onChange("")
  // which round-trips back through the parent as the catalogue default,
  // re-selecting the preset and hiding the text input.
  const [customMode, setCustomMode] = React.useState(!inPresets && hasPresets);

  // If the external value moves into the preset list (e.g. provider change
  // auto-sets a new default), exit custom mode.
  React.useEffect(() => {
    if (inPresets) setCustomMode(false);
  }, [inPresets]);

  const isCustom = !hasPresets || customMode || !inPresets;
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
            if (v === "__custom__") {
              // Show the text input but don't call onChange yet — the
              // parent value remains unchanged until the user types.
              setCustomMode(true);
            } else {
              setCustomMode(false);
              onChange(v);
            }
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
      {isCustom && (
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
