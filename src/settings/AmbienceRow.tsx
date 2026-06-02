import React from "react";

interface AmbienceRowProps {
  level: string;
  unavailable: boolean;
  onChange: (id: string) => void;
  ttsEnabled: boolean;
  duringNarrationOnly: boolean;
  boostWithTTS: boolean;
  onChangeDuringNarrationOnly: (v: boolean) => void;
  onChangeBoostWithTTS: (v: boolean) => void;
  musicLevel?: string;
  onChangeMusicLevel?: (id: string) => void;
}

export function AmbienceRow({ level, unavailable, onChange, ttsEnabled, duringNarrationOnly, boostWithTTS, onChangeDuringNarrationOnly, onChangeBoostWithTTS, musicLevel, onChangeMusicLevel }: AmbienceRowProps) {
  const options = [
    { id: "off", label: "Off", hint: "Silence." },
    { id: "subtle", label: "Subtle", hint: "Barely there." },
    { id: "present", label: "Present", hint: "A felt room." }
  ];
  const musicOptions = [
    { id: "off", label: "Off", hint: "Textures only — no instruments." },
    { id: "sparse", label: "Sparse", hint: "Melodic instruments the scene calls for, no drums." },
    { id: "full", label: "Full", hint: "Melodic instruments plus drums where the mood allows." }
  ];
  const showMusicRow = !unavailable && level !== "off";
  const currentMusic = musicLevel || "full";
  const renderMusicBtn = (opt: { id: string; label: string; hint: string }) => (
    <button
      key={opt.id}
      type="button"
      role="radio"
      aria-checked={currentMusic === opt.id ? "true" : "false"}
      onClick={() => onChangeMusicLevel && onChangeMusicLevel(opt.id)}
      className="icon-btn"
      title={opt.hint}
      style={{
        padding: "6px 12px",
        fontSize: 10,
        letterSpacing: "0.2em",
        borderColor: currentMusic === opt.id ? "rgba(212, 165, 116, 0.55)" : "rgba(232, 222, 197, 0.2)",
        color: currentMusic === opt.id ? "var(--cream-bright)" : "var(--cream-dim)",
        background: currentMusic === opt.id ? "rgba(212, 165, 116, 0.08)" : "transparent"
      }}
    >
      {opt.label.toUpperCase()}
    </button>
  );
  const description = unavailable
    ? "Your browser would not open an audio context. The bed is unavailable."
    : "A synthesised room tone — drone, noise, and texture — that thickens or thins with the scene. Default silence. Begins with the chronicle's opening scene (or your next move if you switch it on mid-story), never on page load.";
  const showCoupling = !unavailable && level !== "off" && ttsEnabled;
  return (
    <div
      className="settings-toggle"
      style={{ cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div
          className="display-font"
          style={{ color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}
        >
          Atmospheric audio
        </div>
        <div
          role="radiogroup"
          aria-label="Atmospheric audio intensity"
          style={{ display: "flex", gap: 6, flexShrink: 0 }}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={level === opt.id ? "true" : "false"}
              disabled={unavailable && opt.id !== "off"}
              onClick={() => onChange(opt.id)}
              className="icon-btn"
              title={opt.hint}
              style={{
                padding: "6px 12px",
                fontSize: 10,
                letterSpacing: "0.2em",
                borderColor: level === opt.id ? "rgba(212, 165, 116, 0.55)" : "rgba(232, 222, 197, 0.2)",
                color: level === opt.id ? "var(--cream-bright)" : "var(--cream-dim)",
                background: level === opt.id ? "rgba(212, 165, 116, 0.08)" : "transparent"
              }}
            >
              {opt.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div
          className="body-font italic"
          style={{ color: "var(--cream-dim)", fontSize: 12 }}
        >
          {description}
        </div>
        {showMusicRow && (
          <div
            style={{ marginTop: 10, paddingLeft: 10, borderLeft: "1px solid rgba(232,222,197,0.15)", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div
              className="body-font italic"
              style={{ fontSize: 11, color: "var(--cream-faint)", letterSpacing: "0.16em", textTransform: "uppercase" }}
            >
              Music
            </div>
            <div role="radiogroup" aria-label="Music level" style={{ display: "flex", gap: 6 }}>
              {musicOptions.map(renderMusicBtn)}
            </div>
            <div
              className="body-font italic"
              style={{ fontSize: 11, color: "var(--cream-faint)", lineHeight: 1.4 }}
            >
              Off = ambient textures only. Sparse adds the melodic instruments the scene's setting calls for (strings, piano, synth, bells, choir…). Full adds a soft pulse of drums when the mood allows.
            </div>
          </div>
        )}
        {showCoupling && (
          <div
            style={{ marginTop: 10, paddingLeft: 10, borderLeft: "1px solid rgba(232,222,197,0.15)", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!duringNarrationOnly}
                onChange={(e) => onChangeDuringNarrationOnly(e.target.checked)}
                style={{ accentColor: "var(--rose-gold)", marginTop: 2, flexShrink: 0 }}
              />
              <span
                className="body-font italic"
                style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }}
              >
                Only during narration — fades in while a turn is read aloud, out to silence between turns.
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!boostWithTTS}
                onChange={(e) => onChangeBoostWithTTS(e.target.checked)}
                style={{ accentColor: "var(--rose-gold)", marginTop: 2, flexShrink: 0 }}
              />
              <span
                className="body-font italic"
                style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.5 }}
              >
                Boost with voice — lift ambience one notch so it isn't buried under speech.
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
