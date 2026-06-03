import React from "react";

interface SettingsToggleRowProps {
  id: string;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function SettingsToggleRow({ id, label, description, value, onChange }: SettingsToggleRowProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={value}
      className="flex items-center justify-between gap-4 px-4 py-3 border border-cream/10 bg-[#1c162c]/40 transition-[border-color] duration-[250ms] cursor-pointer text-left w-full hover:border-rose-gold/30"
      onClick={() => onChange(!value)}
    >
      <div className="flex-1 min-w-0">
        <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
          {label}
        </div>
        <div className="font-body italic text-cream-dim text-[12px] mt-1">
          {description}
        </div>
      </div>
      <span
        className="group relative w-[34px] h-[18px] rounded-[9px] bg-cream/15 border border-cream/25 transition-all duration-[250ms] shrink-0 data-[on=true]:bg-rose-gold/35 data-[on=true]:border-rose-gold/70"
        data-on={value ? "true" : "false"}
        aria-hidden="true"
      >
        <span className="absolute top-px left-px w-[14px] h-[14px] rounded-full bg-cream-bright transition-transform duration-[250ms] group-data-[on=true]:translate-x-4 group-data-[on=true]:bg-rose-gold" />
      </span>
    </button>
  );
}
