import React from "react";
import { ApiKeysSection } from "../../settings/ApiKeysSection.jsx";
import { EngineSection } from "../../settings/EngineSection.jsx";
import { AmbienceRow } from "../../settings/AmbienceRow.jsx";
import { TTSRow } from "../../settings/TTSRow.jsx";
import { SettingsToggleRow } from "../../settings/SettingsToggleRow.jsx";
import { CodexSection } from "../../settings/CodexSection.jsx";

export function SettingsModal({ settings, onChange, onClose, osReducedMotion,
  ambienceLevel, ambienceUnavailable, ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceMusicLevel,
  onChangeAmbience, onChangeAmbienceDuringNarrationOnly, onChangeAmbienceBoostWithTTS, onChangeAmbienceMusicLevel,
  ttsEnabled, ttsProviderId, ttsProviderReady, ttsVoiceId, ttsBrowserVoices, ttsVoxtralVoices, ttsVoxtralVoicesError, ttsRate, ttsElevenKey,
  onChangeTtsEnabled, onChangeTtsProvider, onChangeTtsVoice, onChangeTtsRate, onChangeTtsElevenKey }) {
  return /* @__PURE__ */ React.createElement("div", {
    className: "modal-backdrop",
    onClick: onClose
  }, /* @__PURE__ */ React.createElement("div", {
    className: "modal-panel",
    onClick: (e) => e.stopPropagation()
  }, /* @__PURE__ */ React.createElement("div", {
    className: "px-6 py-5 border-b flex items-center justify-between",
    style: { borderColor: "rgba(232, 222, 197, 0.1)" }
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", {
    className: "display-font text-[10px] mb-1",
    style: { color: "var(--cream-faint)", letterSpacing: "0.4em" }
  }, "⚙ READING PREFERENCES"), /* @__PURE__ */ React.createElement("h2", {
    className: "display-font text-xl",
    style: { color: "var(--cream-bright)", letterSpacing: "0.04em" }
  }, "Set the page to your eyes")), /* @__PURE__ */ React.createElement("button", {
    onClick: onClose,
    className: "display-font text-sm",
    style: { color: "var(--cream-dim)", letterSpacing: "0.2em" },
    "aria-label": "Close"
  }, "✕")), /* @__PURE__ */ React.createElement("div", {
    className: "overflow-y-auto px-6 py-5 space-y-3"
  }, /* @__PURE__ */ React.createElement("p", {
    className: "body-font italic text-sm",
    style: { color: "var(--cream-dim)", lineHeight: 1.6 }
  }, "The hour is told in cream-and-twilight by default. If that's hard on your reading, soften the rules below. Your choices are kept between sessions."), /* @__PURE__ */ React.createElement(EngineSection, {
    settings,
    onChange
  }), /* @__PURE__ */ React.createElement(ApiKeysSection, null), /* @__PURE__ */ React.createElement(SettingsToggleRow, {
    id: "setting-high-contrast",
    label: "High contrast",
    description: "Bright text on flat black; no grain, no vignette, no atmospheric haze.",
    value: settings.highContrast,
    onChange: (v) => onChange("highContrast", v)
  }), /* @__PURE__ */ React.createElement(SettingsToggleRow, {
    id: "setting-disable-typewriter",
    label: "Reveal at once",
    description: "Skip the typewriter animation. Narration appears all at once, the moment it arrives.",
    value: settings.disableTypewriter,
    onChange: (v) => onChange("disableTypewriter", v)
  }), /* @__PURE__ */ React.createElement(SettingsToggleRow, {
    id: "setting-stream-narration",
    label: "Stream the narration",
    description: "Let narration arrive word by word as the narrator writes it, instead of waiting for the whole passage. The opening scene always arrives whole.",
    value: settings.streamNarration,
    onChange: (v) => onChange("streamNarration", v)
  }), /* @__PURE__ */ React.createElement(AmbienceRow, {
    level: ambienceLevel,
    unavailable: ambienceUnavailable,
    onChange: onChangeAmbience,
    ttsEnabled,
    duringNarrationOnly: ambienceDuringNarrationOnly,
    boostWithTTS: ambienceBoostWithTTS,
    musicLevel: ambienceMusicLevel,
    onChangeDuringNarrationOnly: onChangeAmbienceDuringNarrationOnly,
    onChangeBoostWithTTS: onChangeAmbienceBoostWithTTS,
    onChangeMusicLevel: onChangeAmbienceMusicLevel
  }), /* @__PURE__ */ React.createElement(TTSRow, {
    enabled: ttsEnabled,
    providerId: ttsProviderId,
    providerReady: ttsProviderReady,
    voiceId: ttsVoiceId,
    browserVoices: ttsBrowserVoices,
    voxtralVoices: ttsVoxtralVoices,
    voxtralVoicesError: ttsVoxtralVoicesError,
    rate: ttsRate,
    elevenKey: ttsElevenKey,
    onChangeEnabled: onChangeTtsEnabled,
    onChangeProvider: onChangeTtsProvider,
    onChangeVoice: onChangeTtsVoice,
    onChangeRate: onChangeTtsRate,
    onChangeElevenKey: onChangeTtsElevenKey
  }), /* @__PURE__ */ React.createElement(CodexSection, {
    settings,
    onChange
  }), /* @__PURE__ */ React.createElement("div", {
    className: "settings-toggle",
    style: { cursor: "default", opacity: 0.85 }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "display-font",
    style: {
      color: "var(--cream-dim)",
      letterSpacing: "0.18em",
      fontSize: 11,
      textTransform: "uppercase"
    }
  }, "System: reduce motion"), /* @__PURE__ */ React.createElement("div", {
    className: "body-font italic",
    style: { color: "var(--cream-faint)", fontSize: 12, marginTop: 4 }
  }, osReducedMotion ? "On — read from your operating system. Animations are stilled and the typewriter is bypassed." : "Off — your operating system is not asking for reduced motion.")), /* @__PURE__ */ React.createElement("span", {
    className: "display-font",
    style: {
      color: osReducedMotion ? "var(--rose-gold)" : "var(--cream-faint)",
      fontSize: 10,
      letterSpacing: "0.3em",
      flexShrink: 0
    }
  }, osReducedMotion ? "ACTIVE" : "INACTIVE"))), /* @__PURE__ */ React.createElement("div", {
    className: "px-6 py-4 border-t flex justify-end",
    style: { borderColor: "rgba(232, 222, 197, 0.1)" }
  }, /* @__PURE__ */ React.createElement("button", {
    onClick: onClose,
    className: "icon-btn",
    style: { padding: "8px 18px" }
  }, "✕ DONE"))));
}
