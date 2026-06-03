import React, { useState } from "react";
import { SAVE_CAP, ONBOARDING_KEY } from "./data/constants";
import { buildCustomPremise } from "./data/premises";
import { GameProvider, useGame, useGameRun } from "./context/GameContext";
import { SettingsProvider, useSettingsContext } from "./context/SettingsContext";
import { PassphraseProvider } from "./context/PassphraseContext";
import { AmbienceProvider } from "./context/AmbienceContext";
import { TTSProvider } from "./context/TTSContext";
import { TitleScreen } from "./components/TitleScreen";
import { GameScreen } from "./components/GameScreen";
import { SavesModal } from "./components/modals/SavesModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { LedgerModal } from "./components/modals/LedgerModal";
import { toPlayerLedger } from "./llm/prompt";
import { ExportFallbackModal } from "./components/modals/ExportFallbackModal";
import { PassphraseModal } from "./components/PassphraseModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { CustomModal } from "./components/modals/CustomModal";
import { useViewport } from "./hooks/useViewport";
import { DebugOverlay } from "./components/DebugOverlay";

/**
 * The view layer that lives *inside* all the providers. Settings, ambience, and
 * TTS are read straight from their contexts by the screens and the settings
 * modal, so this layer only forwards modal open/close state.
 */
interface AppContentProps {
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showCustom: boolean;
  setShowCustom: (v: boolean) => void;
  showLedger: boolean;
  setShowLedger: (v: boolean) => void;
}

function AppContent({
  showSettings, setShowSettings,
  showCustom, setShowCustom,
  showLedger, setShowLedger,
}: AppContentProps) {
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
      <div className="sr-only" aria-live="polite" aria-atomic="true" aria-busy={loading}>{liveRegionText}</div>
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
            ledger={toPlayerLedger(gameState)}
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
      <DebugOverlay enabled={settings.debugOverlay} />
    </div>
  );
}

function AppGate() {
  const [showLedger, setShowLedger] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Resolve onboarding synchronously on first render so we never mount the
  // provider tree before deciding. If GameProvider mounted first it could fire
  // a background health check, find no passphrase, and spawn the global
  // PassphraseModal on top of the OnboardingModal — two modals racing the same
  // first paint. Gate the whole tree behind this until onboarding is done.
  const [onboarded, setOnboarded] = useState(() => {
    try { return !!localStorage.getItem(ONBOARDING_KEY); }
    catch { return true; }
  });

  if (!onboarded) {
    return <OnboardingModal onComplete={() => setOnboarded(true)} />;
  }

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

export function App() {
  // PassphraseProvider wraps both the onboarding flow and the main tree so the
  // session passphrase has a single React owner across the whole app — the
  // onboarding step stashes the chosen passphrase through the same context the
  // settings rows and key resolvers use.
  return (
    <PassphraseProvider>
      <AppGate />
    </PassphraseProvider>
  );
}
