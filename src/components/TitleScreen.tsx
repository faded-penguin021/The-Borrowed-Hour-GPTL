import React from "react";
import { realmGlyph, PREMISES } from "../data/premises";
import { realmPill } from "../data/realmStyles";
import { TOTAL_ENDINGS } from "../hooks/useProgress";
import { LANGUAGES } from "../data/languages";
import { useGameActions, useGameStory, useGameRun } from "../context/GameContext";
import { ErrorRawDetail } from "./ErrorRawDetail";
import { IconButton } from "./ui/IconButton";
import { Bookmark, Settings } from "lucide-react";

// Base look for a premise card. The realm-keyed radial glow and hover accent
// still live on the `.premise-card` class (pseudo-element + per-realm shadow);
// everything else is utilities.
const PREMISE_CARD =
  "premise-card border border-cream/10 " +
  "bg-[linear-gradient(180deg,rgba(28,22,44,0.55)_0%,rgba(10,8,20,0.55)_100%)] " +
  "transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer " +
  "hover:-translate-y-[3px] motion-reduce:hover:translate-y-0 disabled:cursor-wait disabled:opacity-50";

/**
 * Modal toggles come from `App`; the rest comes from the narrow game hooks:
 * actions (premise choice, saves, language setter, endings) from
 * `useGameActions()`, `language` from `useGameStory()`, loading/error from
 * `useGameRun()`.
 */
interface TitleScreenProps {
  onOpenCustom: () => void;
  onOpenSettings: () => void;
}

export function TitleScreen({ onOpenCustom, onOpenSettings }: TitleScreenProps) {
  const {
    beginAdventure: onChoose,
    openSavesModal: onOpenSaves,
    setLanguage: onChangeLanguage,
    getDiscoveredEndings,
  } = useGameActions();
  const { language } = useGameStory();
  const { loading, error } = useGameRun();
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="text-center mb-14 max-w-3xl fade-in">
        <div className="font-display font-medium text-xs mb-7 text-cream-faint tracking-[0.45em]">
          AN HOUR THAT IS NOT YOURS · TYPED IN FREE WORDS
        </div>
        <h1 className="font-display font-medium text-5xl md:text-7xl mb-7 text-cream-bright tracking-[0.04em] leading-[1.05]">
          The Borrowed Hour
        </h1>
        <div className="font-body italic text-lg md:text-xl text-cream-dim">
          Four hours have been lent to you, and one is yours to invent. Spend yours carefully — the hour will come due.
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5 max-w-5xl w-full">
        {PREMISES.map((p, i) => {
          const discovered = getDiscoveredEndings(p.id).length;
          return (
          <button
            key={p.id}
            onClick={() => !loading && onChoose(p)}
            disabled={loading}
            data-realm={p.realm}
            data-testid="premise-card"
            className={`${PREMISE_CARD} text-left p-7 md:p-8`}
            style={{ animation: `fadeIn 0.9s ease-out ${0.3 + i * 0.15}s both` }}
          >
            <div className="flex items-center justify-between mb-5">
              <span className={`inline-block font-display text-[9px] tracking-[0.4em] px-[10px] py-1 border ${realmPill[p.realm]}`}>
                {realmGlyph(p.realm)} {p.realmLabel}
              </span>
              <span className="font-display font-medium text-[10px] text-cream-faint tracking-[0.3em]">
                {["I", "II", "III", "IV"][i]}
              </span>
            </div>
            <h2 className="font-display font-medium text-2xl md:text-3xl mb-4 text-cream-bright leading-[1.15] tracking-[0.02em]">
              {p.title}
            </h2>
            <p className="font-body text-base italic text-cream leading-[1.6]">
              {p.teaser}
            </p>
            {discovered > 0 && (
              <div
                className="mt-5 font-display font-medium text-[10px] text-cream-faint tracking-[0.4em]"
                aria-label={`${discovered} of ${TOTAL_ENDINGS} endings discovered`}
              >
                {discovered} / {TOTAL_ENDINGS} ENDINGS DISCOVERED
              </div>
            )}
          </button>
          );
        })}
        <button
          onClick={() => !loading && onOpenCustom()}
          disabled={loading}
          data-realm="wild"
          className={`${PREMISE_CARD} text-center p-7 md:p-8 md:col-span-2`}
          style={{ animation: `fadeIn 0.9s ease-out ${0.3 + 4 * 0.15}s both` }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className={`inline-block font-display text-[9px] tracking-[0.4em] px-[10px] py-1 border ${realmPill.wild}`}>
              {realmGlyph("wild")} WILD
            </span>
            <span className="font-display font-medium text-[10px] text-cream-faint tracking-[0.3em]">
              V
            </span>
          </div>
          <h2 className="font-display font-medium text-2xl md:text-3xl mb-3 text-cream-bright leading-[1.15] tracking-[0.02em]">
            The Unwritten Hour
          </h2>
          <p className="font-body text-base italic max-w-xl mx-auto text-cream leading-[1.6]">
            A door of your own making. Describe a world, a self, a situation — the hour will be drawn from your words.
          </p>
        </button>
      </div>
      <div className="mt-10 flex items-center gap-4 flex-wrap justify-center">
        <select
          value={language}
          onChange={(e) => onChangeLanguage(e.target.value)}
          disabled={loading}
          className="lang-select"
          aria-label="Choose the language of your hour"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
        <IconButton onClick={onOpenSaves} disabled={loading} pad="px-[18px] py-2">
          <Bookmark size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />RESUME AN HOUR
        </IconButton>
        <IconButton
          onClick={onOpenSettings}
          disabled={loading}
          pad="px-[18px] py-2"
          aria-label="Reader preferences"
          title="Reader preferences — contrast, motion, typewriter"
        >
          <Settings size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />READING
        </IconButton>
      </div>
      {loading && (
        <div className="mt-12 font-body italic text-lg slow-fade-in text-cream-dim">
          The hour begins
          <span className="typing-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}
      {error && (
        <div className="mt-12 italic text-center max-w-md font-body text-rose-ember">
          <div>{error.message}</div>
          {error.detail && (
            <div className="mt-2 text-[12px] opacity-60 italic tracking-[0.01em]">
              {error.detail}
            </div>
          )}
          <ErrorRawDetail raw={error.raw} />
        </div>
      )}
      <div className="mt-16 text-center max-w-xl fade-in [animation-delay:1.1s]">
        <div className="font-display font-medium text-[10px] mb-3 text-cream-faint tracking-[0.4em]">
          A NOTE TO THE BORROWER
        </div>
        <p className="font-body italic text-base text-cream-faint leading-[1.65]">
          Speak as you would speak — single verbs, full sentences, dialogue, plans, lies. The world will listen, and answer in kind. Set the hour aside when you must rest, and take it up again when you return.
        </p>
      </div>
    </div>
  );
}
