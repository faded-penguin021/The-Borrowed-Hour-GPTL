import type { EngineConfig, ModelEntry, ProviderId } from "../types";
import React from "react";
import { PROVIDER_META, PROVIDER_ORDER, providerSupportsToolUse, TOOL_USE_PROVIDER_ORDER } from "../llm/providers";

interface EngineSelectorProps {
  label: string;
  hint: string;
  engine: EngineConfig;
  onChange: (engine: EngineConfig) => void;
  requireToolUse?: boolean;
}

export function EngineSelector({ label, hint, engine, onChange, requireToolUse = false }: EngineSelectorProps) {
  const allowedProviders = requireToolUse ? TOOL_USE_PROVIDER_ORDER : PROVIDER_ORDER;
  const providerValid = PROVIDER_META[engine?.provider as ProviderId] && (!requireToolUse || providerSupportsToolUse(engine.provider as ProviderId));
  const provider = providerValid ? engine.provider : allowedProviders[0];
  const meta = PROVIDER_META[provider as ProviderId];
  const model = engine?.model || "";
  const isCustom = !meta.models.some((m: ModelEntry) => m.id === model);
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
  return (
    <div style={{ marginTop: 14 }}>
      <div
        className="display-font"
        style={{ color: "var(--cream-dim)", letterSpacing: "0.16em", fontSize: 10, textTransform: "uppercase" }}
      >
        {label}
      </div>
      <div
        className="body-font italic"
        style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 2 }}
      >
        {hint}
      </div>
      <select
        value={provider}
        aria-label={`${label} — provider`}
        onChange={(e) => {
          const np = e.target.value as ProviderId;
          onChange({ provider: np, model: PROVIDER_META[np].models[0].id });
        }}
        style={fieldStyle}
      >
        {allowedProviders.map((id) => (
          <option key={id} value={id}>{PROVIDER_META[id as ProviderId].name}</option>
        ))}
      </select>
      <select
        value={isCustom ? "__custom__" : model}
        aria-label={`${label} — model`}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ provider, model: v === "__custom__" ? "" : v });
        }}
        style={fieldStyle}
      >
        {meta.models.map((m: ModelEntry) => (
          <option key={m.id} value={m.id}>{`${m.id} · ${m.tier}`}</option>
        ))}
        <option key="__custom__" value="__custom__">Custom…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={model}
          placeholder="Enter a model ID"
          aria-label={`${label} — custom model ID`}
          onChange={(e) => onChange({ provider, model: e.target.value })}
          style={fieldStyle}
        />
      )}
    </div>
  );
}
