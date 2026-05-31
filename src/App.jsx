// @ts-check
import React, { useState } from "react";
import { SAVE_CAP } from "./data/constants.js";
import { buildCustomPremise } from "./data/premises.js";
import { GameProvider, useGame, useGameRun } from "./context/GameContext.jsx";
import { SettingsProvider, useSettingsContext } from "./context/SettingsContext.jsx";
import { AmbienceProvider } from "./context/AmbienceContext.jsx";
import { TTSProvider } from "./context/TTSContext.jsx";
import { TitleScreen } from "./components/TitleScreen.jsx";
import { GameScreen } from "./components/GameScreen.jsx";
import { SavesModal } from "./components/modals/SavesModal.jsx";
import { SettingsModal } from "./components/modals/SettingsModal.jsx";
import { LedgerModal } from "./components/modals/LedgerModal.jsx";
import { ExportFallbackModal } from "./components/modals/ExportFallbackModal.jsx";
import { PassphraseModal } from "./components/PassphraseModal.jsx";
import { CustomModal } from "./components/modals/CustomModal.jsx";
import { useViewport } from "./hooks/useViewport.js";

/**
 * The view layer that lives *inside* all the providers. Settings, ambience, and
 * TTS are read straight from their contexts by the screens and the settings
 * modal, so this layer only forwards modal open/close state.
 *
 * @param {{
 *   showSettings: boolean,
 *   setShowSettings: (v: boolean) => void,
 *   showCustom: boolean,
 *   setShowCustom: (v: boolean) => void,
 *   showLedger: boolean,
 *   setShowLedger: (v: boolean) => void,
 * }} props
 */
function AppContent({
  showSettings, setShowSettings,
  showCustom, setShowCustom,
  showLedger, setShowLedger,
}) {
  useViewport();

  const { settings } = useSettingsContext();
  const {
    phase, premise, entries, metaMessages, metaMode, gameState,
    beginAdventure, loadSave,
    showSaves, setShowSaves, saveList, savesTotalBytes, saveListLoading,
    deleteSave,
    exportFallbackText, setExportFallbackText,
  } = useGame();
  const { loading } = useGameRun();

  const liveRegionText = (() => {
    if (metaMode) {
      const lastMeta = [...metaMessages].reverse().find((m) => m.role === "assistant" && m.fullyRevealed);
      return lastMeta?.text || "";
    }
    const lastEntry = [...entries].reverse().find((e) => e.type === "narration" && e.fullyRevealed);
    return lastEntry?.text || "";
  })();

  return (
    <div
      className={`borrowed-root borrowed-vignette borrowed-grain min-h-screen relative overflow-hidden${settings.highContrast ? " high-contrast" : ""}`}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveRegionText}</div>
      <div className="relative z-10">
        {phase === "title" ? (
          <TitleScreen
            onOpenCustom={() => setShowCustom(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <GameScreen
            onOpenLedger={() => setShowLedger(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
        {showSaves && (
          <SavesModal
            saves={saveList}
            totalBytes={savesTotalBytes}
            cap={SAVE_CAP}
            loading={saveListLoading}
            onClose={() => setShowSaves(false)}
            onLoad={loadSave}
            onDelete={deleteSave}
            inGame={phase === "playing"}
          />
        )}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        {showLedger && premise && (
          <LedgerModal
            premise={premise}
            gameState={gameState}
            onClose={() => setShowLedger(false)}
          />
        )}
        {showCustom && (
          <CustomModal
            onClose={() => setShowCustom(false)}
            onBegin={(description) => {
              setShowCustom(false);
              beginAdventure(buildCustomPremise(description));
            }}
            disabled={loading}
          />
        )}
        {exportFallbackText !== null && (
          <ExportFallbackModal
            text={exportFallbackText}
            onClose={() => setExportFallbackText(null)}
          />
        )}
        <PassphraseModal />
      </div>
    </div>
  );
}

export function App() {
  const [showLedger, setShowLedger] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <SettingsProvider>
      <AmbienceProvider>
        <TTSProvider showSettings={showSettings}>
          <GameProvider>
            <AppContent
              showSettings={showSettings}
              setShowSettings={setShowSettings}
              showCustom={showCustom}
              setShowCustom={setShowCustom}
              showLedger={showLedger}
              setShowLedger={setShowLedger}
            />
          </GameProvider>
        </TTSProvider>
      </AmbienceProvider>
    </SettingsProvider>
  );
}
