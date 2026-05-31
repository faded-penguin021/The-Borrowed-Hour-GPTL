// @ts-check
import React from "react";
import { realmGlyph, PREMISES } from "../data/premises.js";
import { TOTAL_ENDINGS } from "../hooks/useProgress.js";
import { LANGUAGES } from "../data/languages.js";
import { useGameActions, useGameStory, useGameRun } from "../context/GameContext.jsx";
import { ErrorRawDetail } from "./ErrorRawDetail.jsx";

/**
 * Modal toggles come from `App`; the rest comes from the narrow game hooks:
 * actions (premise choice, saves, language setter, endings) from
 * `useGameActions()`, `language` from `useGameStory()`, loading/error from
 * `useGameRun()`.
 *
 * @param {Object} props
 * @param {() => void} props.onOpenCustom
 * @param {() => void} props.onOpenSettings
 */
export function TitleScreen({ onOpenCustom, onOpenSettings }) {
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
        <div
          className="display-font text-xs mb-7"
          style={{ color: "var(--cream-faint)", letterSpacing: "0.45em" }}
        >
          AN HOUR THAT IS NOT YOURS · TYPED IN FREE WORDS
        </div>
        <h1
          className="display-font text-5xl md:text-7xl mb-7"
          style={{
            color: "var(--cream-bright)",
            letterSpacing: "0.04em",
            lineHeight: 1.05,
            fontWeight: 500
          }}
        >
          The Borrowed Hour
        </h1>
        <div
          className="body-font italic text-lg md:text-xl"
          style={{ color: "var(--cream-dim)" }}
        >
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
            className="premise-card p-7 md:p-8"
            style={{ animation: `fadeIn 0.9s ease-out ${0.3 + i * 0.15}s both` }}
          >
            <div className="flex items-center justify-between mb-5">
              <span className={`realm-pill realm-${p.realm}`}>
                {realmGlyph(p.realm)} {p.realmLabel}
              </span>
              <span
                className="display-font text-[10px]"
                style={{ color: "var(--cream-faint)", letterSpacing: "0.3em" }}
              >
                {["I", "II", "III", "IV"][i]}
              </span>
            </div>
            <h2
              className="display-font text-2xl md:text-3xl mb-4"
              style={{
                color: "var(--cream-bright)",
                lineHeight: 1.15,
                letterSpacing: "0.02em",
                fontWeight: 500
              }}
            >
              {p.title}
            </h2>
            <p
              className="body-font text-base italic"
              style={{ color: "var(--cream)", lineHeight: 1.6 }}
            >
              {p.teaser}
            </p>
            {discovered > 0 && (
              <div
                className="mt-5 display-font text-[10px]"
                style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
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
          className="premise-card p-7 md:p-8 md:col-span-2"
          style={{
            animation: `fadeIn 0.9s ease-out ${0.3 + 4 * 0.15}s both`,
            textAlign: "center"
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="realm-pill realm-wild">
              {realmGlyph("wild")} WILD
            </span>
            <span
              className="display-font text-[10px]"
              style={{ color: "var(--cream-faint)", letterSpacing: "0.3em" }}
            >
              V
            </span>
          </div>
          <h2
            className="display-font text-2xl md:text-3xl mb-3"
            style={{
              color: "var(--cream-bright)",
              lineHeight: 1.15,
              letterSpacing: "0.02em",
              fontWeight: 500
            }}
          >
            The Unwritten Hour
          </h2>
          <p
            className="body-font text-base italic max-w-xl mx-auto"
            style={{ color: "var(--cream)", lineHeight: 1.6 }}
          >
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
        <button
          onClick={onOpenSaves}
          disabled={loading}
          className="icon-btn"
          style={{ padding: "8px 18px" }}
        >
          ❀ RESUME AN HOUR
        </button>
        <button
          onClick={onOpenSettings}
          disabled={loading}
          className="icon-btn"
          style={{ padding: "8px 18px" }}
          aria-label="Reader preferences"
          title="Reader preferences — contrast, motion, typewriter"
        >
          ⚙ READING
        </button>
      </div>
      {loading && (
        <div
          className="mt-12 body-font italic text-lg slow-fade-in"
          style={{ color: "var(--cream-dim)" }}
        >
          The hour begins
          <span className="typing-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}
      {error && (
        <div
          className="mt-12 italic text-center max-w-md body-font"
          style={{ color: "var(--rose-ember)" }}
        >
          <div>{error.message}</div>
          {error.detail && (
            <div
              className="mt-2"
              style={{
                fontSize: "12px",
                opacity: 0.6,
                fontStyle: "italic",
                letterSpacing: "0.01em"
              }}
            >
              {error.detail}
            </div>
          )}
          <ErrorRawDetail raw={error.raw} />
        </div>
      )}
      <div
        className="mt-16 text-center max-w-xl fade-in"
        style={{ animationDelay: "1.1s" }}
      >
        <div
          className="display-font text-[10px] mb-3"
          style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
        >
          A NOTE TO THE BORROWER
        </div>
        <p
          className="body-font italic text-base"
          style={{ color: "var(--cream-faint)", lineHeight: 1.65 }}
        >
          Speak as you would speak — single verbs, full sentences, dialogue, plans, lies. The world will listen, and answer in kind. Set the hour aside when you must rest, and take it up again when you return.
        </p>
      </div>
    </div>
  );
}
