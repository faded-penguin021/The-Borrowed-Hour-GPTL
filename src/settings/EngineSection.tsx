import type { AppSettings, ProviderId } from "../types";
import React from "react";
import { EngineSelector } from "./EngineSelector";
import { EngineRoleDisplay } from "./EngineRoleDisplay";
import { PROVIDER_META, FREE_MODELS_BY_PROVIDER, TOOL_USE_PROVIDER_ORDER } from "../llm/providers";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface EngineSectionProps {
  settings: AppSettings;
  onChange: (key: string, value: unknown) => void;
}

export function EngineSection({ settings, onChange }: EngineSectionProps) {
  const stack = settings.engineStack || "gemini";
  const free = !!settings.freeModelSelection;
  const fieldClass = "w-full mt-1.5 px-[9px] py-[7px] text-[12px] rounded-md border border-cream/[0.22] bg-[#161215]/90 text-cream-bright";
  const handleStackChange = (newStack: string) => {
    const preset = FREE_MODELS_BY_PROVIDER[newStack as keyof typeof FREE_MODELS_BY_PROVIDER];
    onChange("engineStack", newStack);
    if (preset) {
      const prov = (preset as { provider?: string }).provider || newStack;
      onChange("engineOpening",  { provider: prov, model: preset.opener });
      onChange("engineGM",       { provider: prov, model: preset.gm });
      onChange("engineNarrator", { provider: prov, model: preset.narrator });
    }
  };
  const handleFreeSelection = (enabled: boolean) => {
    onChange("freeModelSelection", enabled);
    if (!enabled) {
      handleStackChange(stack);
    }
  };
  return (
    <div className="block px-4 py-3 border border-cream/10 bg-[#1c162c]/40 transition-[border-color] duration-[250ms] cursor-default text-left w-full hover:border-rose-gold/30">
      <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
        Story engines
      </div>
      <div className="font-body italic text-cream-dim text-[12px] mt-1 leading-[1.6]">
        Three separate models handle distinct roles: the Opener sets the literary tone, the GM resolves logic and state, the Narrator renders player-facing prose. The Opener and GM call structured tools, so they are restricted to providers with reliable tool-use support; the Narrator can use any provider.
      </div>
      {!free && (
        <>
          <div className="font-display font-medium text-cream-dim tracking-[0.16em] text-[10px] uppercase mt-[14px]">
            Model stack
          </div>
          <select
            value={stack}
            aria-label="Model stack"
            onChange={(e) => handleStackChange(e.target.value)}
            className={fieldClass}
          >
            <option key="free" value="free">Free (Mistral)</option>
            {TOOL_USE_PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>{PROVIDER_META[id as ProviderId].name}</option>
            ))}
          </select>
          <EngineRoleDisplay label="Opening scene" engine={settings.engineOpening} />
          <EngineRoleDisplay label="GM logic" engine={settings.engineGM} />
          <EngineRoleDisplay label="Narration & discussion" engine={settings.engineNarrator} />
        </>
      )}
      {free && (
        <>
          <EngineSelector
            label="Opening scene"
            hint="The voice-setting first turn. Tool-use providers only."
            engine={settings.engineOpening}
            onChange={(v) => onChange("engineOpening", v)}
            requireToolUse
          />
          <EngineSelector
            label="GM logic"
            hint="Hidden rules layer: adjudicates actions and updates game state. Tool-use providers only."
            engine={settings.engineGM}
            onChange={(v) => onChange("engineGM", v)}
            requireToolUse
          />
          <EngineSelector
            label="Narration & discussion"
            hint="Renders player-facing prose each turn and post-game discussion."
            engine={settings.engineNarrator}
            onChange={(v) => onChange("engineNarrator", v)}
          />
        </>
      )}
      <SettingsToggleRow
        id="setting-free-model-selection"
        label="Free model selection"
        description="Override the stack and pick any provider and model for each role independently — even mix across providers."
        value={free}
        onChange={handleFreeSelection}
      />
    </div>
  );
}
