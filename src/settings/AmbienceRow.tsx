import React from "react";
import { IconButton } from "../components/ui/IconButton";

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
    <IconButton
      key={opt.id}
      type="button"
      role="radio"
      aria-checked={currentMusic === opt.id ? "true" : "false"}
      onClick={() => onChangeMusicLevel && onChangeMusicLevel(opt.id)}
      title={opt.hint}
      pad="px-3 py-1.5"
      className="text-[10px] tracking-[0.2em]"
      active={currentMusic === opt.id}
    >
      {opt.label.toUpperCase()}
    </IconButton>
  );
  const description = unavailable
    ? "Your browser would not open an audio context. The bed is unavailable."
    : "A synthesised room tone — drone, noise, and texture — that thickens or thins with the scene. Default silence. Begins with the chronicle's opening scene (or your next move if you switch it on mid-story), never on page load.";
  const showCoupling = !unavailable && level !== "off" && ttsEnabled;
  return (
    <div className="flex flex-col items-stretch justify-between gap-2.5 px-4 py-3 border border-cream/10 bg-[#1c162c]/40 transition-[border-color] duration-[250ms] cursor-default text-left w-full hover:border-rose-gold/30">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
          Atmospheric audio
        </div>
        <div
          role="radiogroup"
          aria-label="Atmospheric audio intensity"
          className="flex gap-1.5 shrink-0"
        >
          {options.map((opt) => (
            <IconButton
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={level === opt.id ? "true" : "false"}
              disabled={unavailable && opt.id !== "off"}
              onClick={() => onChange(opt.id)}
              title={opt.hint}
              pad="px-3 py-1.5"
              className="text-[10px] tracking-[0.2em]"
              active={level === opt.id}
            >
              {opt.label.toUpperCase()}
            </IconButton>
          ))}
        </div>
      </div>
      <div>
        <div className="font-body italic text-cream-dim text-[12px]">
          {description}
        </div>
        {showMusicRow && (
          <div className="mt-2.5 pl-2.5 border-l border-cream/15 flex flex-col gap-1.5">
            <div className="font-body italic text-[11px] text-cream-faint tracking-[0.16em] uppercase">
              Music
            </div>
            <div role="radiogroup" aria-label="Music level" className="flex gap-1.5">
              {musicOptions.map(renderMusicBtn)}
            </div>
            <div className="font-body italic text-[11px] text-cream-faint leading-[1.4]">
              Off = ambient textures only. Sparse adds the melodic instruments the scene's setting calls for (strings, piano, synth, bells, choir…). Full adds a soft pulse of drums when the mood allows.
            </div>
          </div>
        )}
        {showCoupling && (
          <div className="mt-2.5 pl-2.5 border-l border-cream/15 flex flex-col gap-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!duringNarrationOnly}
                onChange={(e) => onChangeDuringNarrationOnly(e.target.checked)}
                className="mt-0.5 shrink-0 accent-rose-gold"
              />
              <span className="font-body italic text-[12px] text-cream-dim leading-[1.5]">
                Only during narration — fades in while a turn is read aloud, out to silence between turns.
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!boostWithTTS}
                onChange={(e) => onChangeBoostWithTTS(e.target.checked)}
                className="mt-0.5 shrink-0 accent-rose-gold"
              />
              <span className="font-body italic text-[12px] text-cream-dim leading-[1.5]">
                Boost with voice — lift ambience one notch so it isn't buried under speech.
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
