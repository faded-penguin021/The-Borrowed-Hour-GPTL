import type { EngineConfig, ProviderId } from "../types";
import React from "react";
import { PROVIDER_META } from "../llm/providers";

interface EngineRoleDisplayProps {
  label: string;
  engine: EngineConfig;
}

export function EngineRoleDisplay({ label, engine }: EngineRoleDisplayProps) {
  const providerName = PROVIDER_META[engine?.provider as ProviderId]?.name || engine?.provider || "—";
  const model = engine?.model || "—";
  const fieldClass =
    "w-full mt-1.5 px-[9px] py-[7px] text-xs rounded-md border border-cream/[0.12] " +
    "bg-[#161215]/50 text-cream-dim tracking-[0.02em]";
  return (
    <div className="mt-[14px]">
      <div className="font-display font-medium text-cream-dim tracking-[0.16em] text-[10px] uppercase">
        {label}
      </div>
      <div className={`${fieldClass} flex justify-between items-center font-body`}>
        <span className="text-cream-faint">{providerName}</span>
        <span className="text-cream-dim">{model}</span>
      </div>
    </div>
  );
}
