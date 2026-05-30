// @ts-check
import React, { useState, useEffect } from "react";
import { SAVE_CAP } from "./data/constants.js";
import { buildCustomPremise } from "./data/premises.js";
import { GameProvider, useGame } from "./context/GameContext.jsx";
import { TitleScreen } from "./components/TitleScreen.jsx";
import { GameScreen } from "./components/GameScreen.jsx";
import { SavesModal } from "./components/modals/SavesModal.jsx";
import { SettingsModal } from "./components/modals/SettingsModal.jsx";
import { LedgerModal } from "./components/modals/LedgerModal.jsx";
import { ExportFallbackModal } from "./components/modals/ExportFallbackModal.jsx";
import { PassphraseModal } from "./components/PassphraseModal.jsx";
import { CustomModal } from "./components/modals/CustomModal.jsx";
import { useSettings } from "./hooks/useSettings.js";
import { useAmbience } from "./hooks/useAmbience.js";
import { useTTS } from "./hooks/useTTS.js";
import { useViewport } from "./hooks/useViewport.js";

/**
 * The view layer that lives *inside* the GameProvider, so it can read the core
 * game loop via `useGame()`. Reading/audio preferences come from props because
 * those hooks are owned at the top level (and shared with the settings modal).
 *
 * @param {{
 *   settings: AppSettings,
 *   updateSetting: (key: string, value: any) => void,
 *   ambience: ReturnType<typeof useAmbience>,
 *   tts: ReturnType<typeof useTTS>,
 *   osReducedMotion: boolean,
 *   instantReveal: boolean,
 *   showSettings: boolean,
 *   setShowSettings: (v: boolean) => void,
 *   showCustom: boolean,
 *   setShowCustom: (v: boolean) => void,
 *   showLedger: boolean,
 *   setShowLedger: (v: boolean) => void,
 * }} props
 */
function AppContent({
  settings, updateSetting, ambience, tts,
  osReducedMotion, instantReveal,
  showSettings, setShowSettings,
  showCustom, setShowCustom,
  showLedger, setShowLedger,
}) {
  const game = useGame();
  const {
    phase, premise, entries, metaMessages, metaMode, gameState, loading,
    beginAdventure, loadSave,
    showSaves, setShowSaves, saveList, savesTotalBytes, saveListLoading,
    openSavesModal, deleteSave,
    exportFallbackText, setExportFallbackText,
  } = game;

  const {
    ambienceLevel, ambienceMuted, ambienceUnavailable,
    ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceMusicLevel,
    setAmbienceLevel, setAmbienceMuted,
    setAmbienceDuringNarrationOnly, setAmbienceBoostWithTTS, setAmbienceMusicLevel,
  } = ambience;

  const liveRegionText = (() => {
    if (metaMode) {
      const lastMeta = [...metaMessages].reverse().find((m) => m.role === "assistant" && m.fullyRevealed);
      return lastMeta?.text || "";
    }
    const lastEntry = [...entries].reverse().find((e) => e.type === "narration" && e.fullyRevealed);
    return lastEntry?.text || "";
  })();

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveRegionText}</div>
      <div className="relative z-10">
        {phase === "title" ? (
          <TitleScreen
            onOpenCustom={() => setShowCustom(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <GameScreen
            instantReveal={instantReveal}
            onOpenLedger={() => setShowLedger(true)}
            onOpenSettings={() => setShowSettings(true)}
            ambienceEnabled={ambienceLevel !== "off" && !ambienceUnavailable}
            ambienceMuted={ambienceMuted}
            onToggleAmbienceMute={() => setAmbienceMuted((m) => !m)}
            ttsEnabled={tts.ttsEnabled}
            ttsMuted={tts.ttsMuted}
            ttsPlayback={tts.ttsPlayback}
            onToggleTtsMute={() => tts.setTtsMuted((m) => !m)}
            onPlayEntry={(idx) => tts.playEntry(entries, idx)}
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
        {showSettings && (
          <SettingsModal
            settings={settings}
            onChange={updateSetting}
            onClose={() => setShowSettings(false)}
            osReducedMotion={osReducedMotion}
            ambienceLevel={ambienceLevel}
            ambienceUnavailable={ambienceUnavailable}
            ambienceDuringNarrationOnly={ambienceDuringNarrationOnly}
            ambienceBoostWithTTS={ambienceBoostWithTTS}
            ambienceMusicLevel={ambienceMusicLevel}
            onChangeAmbience={setAmbienceLevel}
            onChangeAmbienceDuringNarrationOnly={setAmbienceDuringNarrationOnly}
            onChangeAmbienceBoostWithTTS={setAmbienceBoostWithTTS}
            onChangeAmbienceMusicLevel={setAmbienceMusicLevel}
            ttsEnabled={tts.ttsEnabled}
            ttsProviderId={tts.ttsProviderId}
            ttsProviderReady={tts.ttsProviderReady}
            ttsVoiceId={tts.ttsVoiceId}
            ttsModel={tts.ttsProviderId ? (tts.ttsModelOverrides[tts.ttsProviderId] || null) : null}
            ttsBrowserVoices={tts.ttsBrowserVoices}
            ttsVoxtralVoices={tts.ttsVoxtralVoices}
            ttsVoxtralVoicesError={tts.ttsVoxtralVoicesError}
            ttsRate={tts.ttsRate}
            ttsElevenKey={tts.ttsElevenKey}
            ttsAzureKey={tts.ttsAzureKey}
            ttsAzureRegion={tts.ttsAzureRegion}
            ttsGoogleKey={tts.ttsGoogleKey}
            onChangeTtsEnabled={tts.setTtsEnabled}
            onChangeTtsProvider={tts.setTtsProviderId}
            onChangeTtsVoice={tts.setTtsVoiceId}
            onChangeTtsModel={(m) => {
              if (!tts.ttsProviderId) return;
              tts.setTtsModelOverrides((prev) => {
                const next = { ...prev };
                if (m) next[tts.ttsProviderId] = m; else delete next[tts.ttsProviderId];
                return next;
              });
            }}
            onChangeTtsRate={tts.setTtsRate}
            onChangeTtsElevenKey={async (k) => {
              tts.setTtsElevenKey(k);
              await tts.saveTtsElevenLabsKey(k);
              tts.detectTtsProviderReady();
            }}
            onChangeTtsAzureKey={async (k) => {
              tts.setTtsAzureKey(k);
              await tts.saveTtsAzureKey(k);
              tts.detectTtsProviderReady();
            }}
            onChangeTtsAzureRegion={(r) => {
              tts.setTtsAzureRegion(r);
              tts.saveTtsAzureRegion(r);
            }}
            onChangeTtsGoogleKey={async (k) => {
              tts.setTtsGoogleKey(k);
              await tts.saveTtsGoogleKey(k);
              tts.detectTtsProviderReady();
            }}
          />
        )}
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
    </>
  );
}

export function App() {
  const [showLedger, setShowLedger] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Domain hooks (shared across screens and the settings modal) ───
  const { settings, updateSetting } = useSettings();
  const ambience = useAmbience();
  const tts = useTTS({ showSettings });

  const [osReducedMotion, setOsReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setOsReducedMotion(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);
  const instantReveal = settings.disableTypewriter || osReducedMotion;

  useViewport();

  // ── Ambience↔TTS coupling (both hooks live here) ─────────────────
  const { ambienceRef, ambienceEngineNonce, ambienceDuringNarrationOnly, ambienceBoostWithTTS, ambienceLevel } = ambience;
  useEffect(() => {
    ambienceRef.current?.setSpeechGate(ambienceDuringNarrationOnly && tts.ttsEnabled);
  }, [ambienceDuringNarrationOnly, tts.ttsEnabled, ambienceEngineNonce]);

  useEffect(() => {
    ambienceRef.current?.setBoost(ambienceBoostWithTTS && tts.ttsEnabled);
  }, [ambienceBoostWithTTS, tts.ttsEnabled, ambienceEngineNonce]);

  useEffect(() => {
    const ctrl = tts.ttsRef.current;
    const eng = ambienceRef.current;
    if (!ctrl || !eng) return;
    const u1 = ctrl.onSpeakStart(() => eng.notifySpeechStart());
    const u2 = ctrl.onSpeakEnd(() => eng.notifySpeechEnd());
    return () => { u1(); u2(); };
  }, [tts.ttsEnabled, ambienceLevel, ambienceEngineNonce]);

  return (
    <div
      className={`borrowed-root borrowed-vignette borrowed-grain min-h-screen relative overflow-hidden${settings.highContrast ? " high-contrast" : ""}`}
    >
      <GameProvider settings={settings} ambience={ambience} tts={tts}>
        <AppContent
          settings={settings}
          updateSetting={updateSetting}
          ambience={ambience}
          tts={tts}
          osReducedMotion={osReducedMotion}
          instantReveal={instantReveal}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          showCustom={showCustom}
          setShowCustom={setShowCustom}
          showLedger={showLedger}
          setShowLedger={setShowLedger}
        />
      </GameProvider>
    </div>
  );
}
