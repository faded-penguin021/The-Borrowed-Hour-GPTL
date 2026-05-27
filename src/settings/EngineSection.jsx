import React from "react";
import { EngineSelector } from "./EngineSelector.jsx";
import { EngineRoleDisplay } from "./EngineRoleDisplay.jsx";
import { PROVIDER_META, FREE_MODELS_BY_PROVIDER, TOOL_USE_PROVIDER_ORDER } from "../llm/providers.js";
import { SettingsToggleRow } from "./SettingsToggleRow.jsx";

export function EngineSection({ settings, onChange }) {
  const stack = settings.engineStack || "gemini";
  const free = !!settings.freeModelSelection;
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
  const handleStackChange = (newStack) => {
    const preset = FREE_MODELS_BY_PROVIDER[newStack];
    onChange("engineStack", newStack);
    if (preset) {
      const prov = preset.provider || newStack;
      onChange("engineOpening",  { provider: prov, model: preset.opener });
      onChange("engineGM",       { provider: prov, model: preset.gm });
      onChange("engineNarrator", { provider: prov, model: preset.narrator });
    }
  };
  const handleFreeSelection = (enabled) => {
    onChange("freeModelSelection", enabled);
    if (!enabled) {
      handleStackChange(stack);
    }
  };
  return /* @__PURE__ */ React.createElement("div", {
    className: "settings-toggle",
    style: { cursor: "default", display: "block" }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "display-font",
    style: { color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }
  }, "Story engines"), /* @__PURE__ */ React.createElement("div", {
    className: "body-font italic",
    style: { color: "var(--cream-dim)", fontSize: 12, marginTop: 4, lineHeight: 1.6 }
  }, "Three separate models handle distinct roles: the Opener sets the literary tone, the GM resolves logic and state, the Narrator renders player-facing prose. The Opener and GM call structured tools, so they are restricted to providers with reliable tool-use support; the Narrator can use any provider."),
  !free && /* @__PURE__ */ React.createElement(React.Fragment, null,
    /* @__PURE__ */ React.createElement("div", {
      className: "display-font",
      style: { color: "var(--cream-dim)", letterSpacing: "0.16em", fontSize: 10, textTransform: "uppercase", marginTop: 14 }
    }, "Model stack"),
    /* @__PURE__ */ React.createElement("select", {
      value: stack,
      "aria-label": "Model stack",
      onChange: (e) => handleStackChange(e.target.value),
      style: fieldStyle
    }, [
      /* @__PURE__ */ React.createElement("option", { key: "free", value: "free" }, "Free (Mistral)"),
      ...TOOL_USE_PROVIDER_ORDER.map((id) => /* @__PURE__ */ React.createElement("option", { key: id, value: id }, PROVIDER_META[id].name))
    ]),
    /* @__PURE__ */ React.createElement(EngineRoleDisplay, { label: "Opening scene",        engine: settings.engineOpening }),
    /* @__PURE__ */ React.createElement(EngineRoleDisplay, { label: "GM logic",             engine: settings.engineGM }),
    /* @__PURE__ */ React.createElement(EngineRoleDisplay, { label: "Narration & discussion",engine: settings.engineNarrator })
  ),
  free && /* @__PURE__ */ React.createElement(React.Fragment, null,
    /* @__PURE__ */ React.createElement(EngineSelector, {
      label: "Opening scene",
      hint: "The voice-setting first turn. Tool-use providers only.",
      engine: settings.engineOpening,
      onChange: (v) => onChange("engineOpening", v),
      requireToolUse: true
    }),
    /* @__PURE__ */ React.createElement(EngineSelector, {
      label: "GM logic",
      hint: "Hidden rules layer: adjudicates actions and updates game state. Tool-use providers only.",
      engine: settings.engineGM,
      onChange: (v) => onChange("engineGM", v),
      requireToolUse: true
    }),
    /* @__PURE__ */ React.createElement(EngineSelector, {
      label: "Narration & discussion",
      hint: "Renders player-facing prose each turn and post-game discussion.",
      engine: settings.engineNarrator,
      onChange: (v) => onChange("engineNarrator", v)
    })
  ),
  /* @__PURE__ */ React.createElement(SettingsToggleRow, {
    id: "setting-free-model-selection",
    label: "Free model selection",
    description: "Override the stack and pick any provider and model for each role independently — even mix across providers.",
    value: free,
    onChange: handleFreeSelection
  }));
}
