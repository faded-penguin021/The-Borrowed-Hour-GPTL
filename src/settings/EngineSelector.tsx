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
  const fieldClass = "w-full mt-1.5 px-[9px] py-[7px] text-[12px] rounded-md border border-cream/[0.22] bg-[#161215]/90 text-cream-bright";
  return (
    <div className="mt-[14px]">
      <div className="font-display font-medium text-cream-dim tracking-[0.16em] text-[10px] uppercase">
        {label}
      </div>
      <div className="font-body italic text-cream-faint text-[11px] mt-0.5">
        {hint}
      </div>
      <select
        value={provider}
        aria-label={`${label} — provider`}
        onChange={(e) => {
          const np = e.target.value as ProviderId;
          onChange({ provider: np, model: PROVIDER_META[np].models[0].id });
        }}
        className={fieldClass}
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
        className={fieldClass}
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
          className={fieldClass}
        />
      )}
    </div>
  );
}
