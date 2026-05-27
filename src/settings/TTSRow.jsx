import React, { useState, useEffect } from "react";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue.js";

export function TTSRow({ enabled, providerId, providerReady, voiceId, browserVoices, voxtralVoices, voxtralVoicesError, rate, elevenKey, onChangeEnabled, onChangeProvider, onChangeVoice, onChangeRate, onChangeElevenKey }) {
  const [elevenInput, setElevenInput] = React.useState(elevenKey || "");
  const [elevenSaved, setElevenSaved] = React.useState(false);
  const providers = TTS_PROVIDER_ORDER.map((id) => TTS_PROVIDER_META[id]);
  const ready = providerReady || {};
  const activeMeta = TTS_PROVIDER_META[providerId] || null;
  const voices = providerId === "browser"
    ? (browserVoices || []).map((v) => ({ id: v.name, label: `${v.name} — ${v.lang}` }))
    : providerId === "voxtral"
      ? (voxtralVoices && voxtralVoices.length > 0 ? voxtralVoices : (activeMeta?.voices || []))
      : (activeMeta?.voices || []);
  const allowCustomVoiceId = !!activeMeta?.allowCustomVoiceId;
  return /* @__PURE__ */ React.createElement("div", {
    className: "settings-toggle",
    style: { cursor: "default", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 min-w-0", style: { width: "100%" }
  },
    /* @__PURE__ */ React.createElement("div", {
      className: "display-font",
      style: { color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }
    }, "Narration aloud"),
    /* @__PURE__ */ React.createElement("div", {
      className: "body-font italic",
      style: { color: "var(--cream-dim)", fontSize: 12, marginTop: 4, marginBottom: 10 }
    }, "Read each turn's narration aloud. Providers marked Ready use a key you've already set."),
    /* Enable toggle */
    /* @__PURE__ */ React.createElement("label", {
      style: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }
    }, /* @__PURE__ */ React.createElement("input", {
      type: "checkbox", checked: !!enabled,
      onChange: (e) => onChangeEnabled(e.target.checked),
      style: { accentColor: "var(--rose-gold)" }
    }), /* @__PURE__ */ React.createElement("span", {
      className: "display-font",
      style: { fontSize: 11, letterSpacing: "0.2em", color: "var(--cream-bright)" }
    }, enabled ? "READING ALOUD" : "SILENT")),
    /* Provider picker */
    /* @__PURE__ */ React.createElement("div", {
      style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: enabled ? 10 : 0 }
    }, providers.map((p) => {
      const isReady = !p.requiresKey || ready[p.id];
      const isActive = providerId === p.id;
      return /* @__PURE__ */ React.createElement("button", {
        key: p.id,
        type: "button",
        onClick: () => onChangeProvider(p.id),
        className: "icon-btn",
        title: p.requiresKey && !isReady
          ? (p.reusesLLMKey ? `Set the ${p.reusesLLMKey === "openai" ? "OpenAI" : p.reusesLLMKey === "mistral" ? "Mistral" : p.reusesLLMKey} key in Settings → API keys` : "Enter your ElevenLabs key below")
          : p.name,
        style: {
          padding: "5px 10px",
          fontSize: 10,
          letterSpacing: "0.15em",
          display: "flex",
          alignItems: "center",
          gap: 5,
          borderColor: isActive ? "rgba(212, 165, 116, 0.55)" : "rgba(232, 222, 197, 0.2)",
          color: isActive ? "var(--cream-bright)" : "var(--cream-dim)",
          background: isActive ? "rgba(212, 165, 116, 0.08)" : "transparent"
        }
      }, p.name.toUpperCase(), /* @__PURE__ */ React.createElement("span", {
        style: {
          fontSize: 8,
          letterSpacing: "0.2em",
          padding: "1px 4px",
          borderRadius: 2,
          background: isReady ? "rgba(212,165,116,0.15)" : "rgba(232,222,197,0.06)",
          color: isReady ? "var(--rose-gold)" : "var(--cream-faint)"
        }
      }, isReady ? "READY" : "NEEDS KEY"));
    })),
    /* ElevenLabs inline key field */
    providerId === "elevenlabs" && /* @__PURE__ */ React.createElement("div", {
      style: { display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }
    }, /* @__PURE__ */ React.createElement("input", {
      type: "password",
      value: elevenInput,
      onChange: (e) => { setElevenInput(e.target.value); setElevenSaved(false); },
      placeholder: "ElevenLabs API key…",
      className: "body-font",
      style: { flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }
    }), /* @__PURE__ */ React.createElement("button", {
      className: "icon-btn",
      style: { padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" },
      onClick: async () => { await onChangeElevenKey(elevenInput); setElevenSaved(true); }
    }, elevenSaved ? "SAVED ✓" : "SAVE")),
    /* Voxtral voice-fetch status */
    enabled && providerId === "voxtral" && voxtralVoicesError && /* @__PURE__ */ React.createElement("div", {
      className: "body-font italic",
      style: { color: "var(--rose-ember)", fontSize: 11, marginBottom: 6, opacity: 0.85 }
    }, "Voice list: ", voxtralVoicesError),
    enabled && providerId === "voxtral" && !voxtralVoicesError && (!voxtralVoices || voxtralVoices.length === 0) && /* @__PURE__ */ React.createElement("div", {
      className: "body-font italic",
      style: { color: "var(--cream-faint)", fontSize: 11, marginBottom: 6 }
    }, "Loading voice list…"),
    /* Voice picker */
    enabled && voices.length > 0 && /* @__PURE__ */ React.createElement("label", {
      style: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }
    }, /* @__PURE__ */ React.createElement("span", {
      className: "display-font",
      style: { fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-dim)" }
    }, "VOICE"), /* @__PURE__ */ React.createElement("select", {
      value: voices.some((v) => v.id === voiceId) ? voiceId : "",
      onChange: (e) => onChangeVoice(e.target.value || null),
      className: "body-font",
      style: { background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "6px 10px", fontSize: 13, maxWidth: "100%" }
    }, providerId === "browser" && /* @__PURE__ */ React.createElement("option", { value: "" }, "Automatic"),
       allowCustomVoiceId && voiceId && !voices.some((v) => v.id === voiceId) && /* @__PURE__ */ React.createElement("option", { value: voiceId }, `Custom — ${voiceId.slice(0, 16)}…`),
       voices.map((v) => /* @__PURE__ */ React.createElement("option", { key: v.id, value: v.id }, v.label)))),
    /* Custom voice ID — for cloned voices (ElevenLabs) or extra Voxtral presets */
    enabled && allowCustomVoiceId && /* @__PURE__ */ React.createElement("label", {
      style: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }
    }, /* @__PURE__ */ React.createElement("span", {
      className: "display-font",
      style: { fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-dim)" }
    }, "CUSTOM VOICE ID"), /* @__PURE__ */ React.createElement("input", {
      type: "text",
      value: voiceId || "",
      onChange: (e) => onChangeVoice(e.target.value.trim() || null),
      placeholder: providerId === "voxtral"
        ? "Paste any Voxtral voice id (e.g. en_paul_neutral) or cloned voice id"
        : "Paste any ElevenLabs voice ID (e.g. cloned voice)",
      className: "body-font",
      autoComplete: "off",
      spellCheck: false,
      style: { background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12, fontFamily: "monospace" }
    })),
    /* Rate slider */
    enabled && /* @__PURE__ */ React.createElement("label", {
      style: { display: "flex", flexDirection: "column", gap: 4 }
    }, /* @__PURE__ */ React.createElement("span", {
      className: "display-font",
      style: { fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-dim)" }
    }, `READING PACE — ${(rate || 1).toFixed(2)}×`), /* @__PURE__ */ React.createElement("input", {
      type: "range", min: "0.5", max: "2.0", step: "0.05", value: rate,
      onChange: (e) => onChangeRate(parseFloat(e.target.value)),
      style: { accentColor: "var(--rose-gold)" }
    }))
  ));
}
