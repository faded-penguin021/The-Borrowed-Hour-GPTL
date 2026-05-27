import React from "react";

export function AmbienceRow({ level, unavailable, onChange, ttsEnabled, duringNarrationOnly, boostWithTTS, onChangeDuringNarrationOnly, onChangeBoostWithTTS }) {
  const options = [
    { id: "off", label: "Off", hint: "Silence." },
    { id: "subtle", label: "Subtle", hint: "Barely there." },
    { id: "present", label: "Present", hint: "A felt room." }
  ];
  const description = unavailable
    ? "Your browser would not open an audio context. The bed is unavailable."
    : "A synthesised room tone — drone, noise, and texture — that thickens or thins with the scene. Default silence. Starts on your next move, never on page load.";
  const showCoupling = !unavailable && level !== "off" && ttsEnabled;
  return /* @__PURE__ */ React.createElement("div", {
    className: "settings-toggle",
    style: { cursor: "default", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }
  }, /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "display-font",
    style: { color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }
  }, "Atmospheric audio"), /* @__PURE__ */ React.createElement("div", {
    className: "body-font italic",
    style: { color: "var(--cream-dim)", fontSize: 12, marginTop: 4 }
  }, description),
  showCoupling && /* @__PURE__ */ React.createElement("div", {
    style: { marginTop: 10, paddingLeft: 10, borderLeft: "1px solid rgba(232,222,197,0.15)", display: "flex", flexDirection: "column", gap: 8 }
  },
    /* @__PURE__ */ React.createElement("label", {
      style: { display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }
    }, /* @__PURE__ */ React.createElement("input", {
      type: "checkbox", checked: !!duringNarrationOnly,
      onChange: (e) => onChangeDuringNarrationOnly(e.target.checked),
      style: { accentColor: "var(--rose-gold)", marginTop: 2, flexShrink: 0 }
    }), /* @__PURE__ */ React.createElement("span", {
      className: "body-font italic",
      style: { fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }
    }, "Only during narration — fades in while a turn is read aloud, out to silence between turns.")),
    /* @__PURE__ */ React.createElement("label", {
      style: { display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }
    }, /* @__PURE__ */ React.createElement("input", {
      type: "checkbox", checked: !!boostWithTTS,
      onChange: (e) => onChangeBoostWithTTS(e.target.checked),
      style: { accentColor: "var(--rose-gold)", marginTop: 2, flexShrink: 0 }
    }), /* @__PURE__ */ React.createElement("span", {
      className: "body-font italic",
      style: { fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }
    }, "Boost with voice — lift ambience one notch so it isn't buried under speech."))
  )), /* @__PURE__ */ React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Atmospheric audio intensity",
    style: { display: "flex", gap: 6, flexShrink: 0 }
  }, options.map((opt) => /* @__PURE__ */ React.createElement("button", {
    key: opt.id,
    type: "button",
    role: "radio",
    "aria-checked": level === opt.id ? "true" : "false",
    disabled: unavailable && opt.id !== "off",
    onClick: () => onChange(opt.id),
    className: "icon-btn",
    title: opt.hint,
    style: {
      padding: "6px 12px",
      fontSize: 10,
      letterSpacing: "0.2em",
      borderColor: level === opt.id ? "rgba(212, 165, 116, 0.55)" : "rgba(232, 222, 197, 0.2)",
      color: level === opt.id ? "var(--cream-bright)" : "var(--cream-dim)",
      background: level === opt.id ? "rgba(212, 165, 116, 0.08)" : "transparent"
    }
  }, opt.label.toUpperCase()))));
}
