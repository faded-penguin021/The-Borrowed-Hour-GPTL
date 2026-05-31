// @ts-check
import React from "react";
import { ApiKeysSection } from "../../settings/ApiKeysSection.jsx";
import { EngineSection } from "../../settings/EngineSection.jsx";
import { AmbienceRow } from "../../settings/AmbienceRow.jsx";
import { TTSRow } from "../../settings/TTSRow.jsx";
import { SettingsToggleRow } from "../../settings/SettingsToggleRow.jsx";
import { CodexSection } from "../../settings/CodexSection.jsx";
import { useSettingsContext } from "../../context/SettingsContext.jsx";
import { useAmbienceContext } from "../../context/AmbienceContext.jsx";
import { useTTSContext } from "../../context/TTSContext.jsx";

/**
 * Reads reading/display settings, ambience, and TTS straight from their
 * contexts; the only prop is the modal close handler.
 * @param {{ onClose: () => void }} props
 */
export function SettingsModal({ onClose }) {
  const { settings, updateSetting, osReducedMotion } = useSettingsContext();
  const onChange = updateSetting;
  const ambience = useAmbienceContext();
  const tts = useTTSContext();

  const {
    ambienceLevel, ambienceUnavailable, ambienceDuringNarrationOnly,
    ambienceBoostWithTTS, ambienceMusicLevel,
    setAmbienceLevel, setAmbienceDuringNarrationOnly, setAmbienceBoostWithTTS, setAmbienceMusicLevel,
  } = ambience;
  const onChangeAmbience = setAmbienceLevel;
  const onChangeAmbienceDuringNarrationOnly = setAmbienceDuringNarrationOnly;
  const onChangeAmbienceBoostWithTTS = setAmbienceBoostWithTTS;
  const onChangeAmbienceMusicLevel = setAmbienceMusicLevel;

  const {
    ttsEnabled, ttsProviderId, ttsProviderReady, ttsVoiceId,
    ttsBrowserVoices, ttsVoxtralVoices, ttsVoxtralVoicesError, ttsRate,
    ttsElevenKey, ttsAzureKey, ttsAzureRegion, ttsGoogleKey, ttsModelOverrides,
    setTtsEnabled, setTtsProviderId, setTtsVoiceId, setTtsRate,
    setTtsElevenKey, setTtsAzureKey, setTtsAzureRegion, setTtsGoogleKey, setTtsModelOverrides,
    detectTtsProviderReady, saveTtsElevenLabsKey, saveTtsAzureKey, saveTtsAzureRegion, saveTtsGoogleKey,
  } = tts;
  const ttsModel = ttsProviderId ? (ttsModelOverrides[ttsProviderId] || null) : null;
  const onChangeTtsEnabled = setTtsEnabled;
  const onChangeTtsProvider = setTtsProviderId;
  const onChangeTtsVoice = setTtsVoiceId;
  const onChangeTtsRate = setTtsRate;
  const onChangeTtsModel = (m) => {
    if (!ttsProviderId) return;
    setTtsModelOverrides((prev) => {
      const next = { ...prev };
      if (m) next[ttsProviderId] = m; else delete next[ttsProviderId];
      return next;
    });
  };
  const onChangeTtsElevenKey = async (k) => { setTtsElevenKey(k); await saveTtsElevenLabsKey(k); detectTtsProviderReady(); };
  const onChangeTtsAzureKey = async (k) => { setTtsAzureKey(k); await saveTtsAzureKey(k); detectTtsProviderReady(); };
  const onChangeTtsAzureRegion = (r) => { setTtsAzureRegion(r); saveTtsAzureRegion(r); };
  const onChangeTtsGoogleKey = async (k) => { setTtsGoogleKey(k); await saveTtsGoogleKey(k); detectTtsProviderReady(); };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <div>
            <div
              className="display-font text-[10px] mb-1"
              style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
            >
              ⚙ READING PREFERENCES
            </div>
            <h2
              className="display-font text-xl"
              style={{ color: "var(--cream-bright)", letterSpacing: "0.04em" }}
            >
              Set the page to your eyes
            </h2>
          </div>
          <button
            onClick={onClose}
            className="display-font text-sm"
            style={{ color: "var(--cream-dim)", letterSpacing: "0.2em" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-3">
          <p
            className="body-font italic text-sm"
            style={{ color: "var(--cream-dim)", lineHeight: 1.6 }}
          >
            The hour is told in cream-and-twilight by default. If that's hard on your reading, soften the rules below. Your choices are kept between sessions.
          </p>
          <EngineSection settings={settings} onChange={onChange} />
          <ApiKeysSection />
          <SettingsToggleRow
            id="setting-high-contrast"
            label="High contrast"
            description="Bright text on flat black; no grain, no vignette, no atmospheric haze."
            value={settings.highContrast}
            onChange={(v) => onChange("highContrast", v)}
          />
          <SettingsToggleRow
            id="setting-disable-typewriter"
            label="Reveal at once"
            description="Skip the typewriter animation. Narration appears all at once, the moment it arrives."
            value={settings.disableTypewriter}
            onChange={(v) => onChange("disableTypewriter", v)}
          />
          <SettingsToggleRow
            id="setting-stream-narration"
            label="Stream the narration"
            description="Let narration arrive word by word as the narrator writes it, instead of waiting for the whole passage. The opening scene always arrives whole."
            value={settings.streamNarration}
            onChange={(v) => onChange("streamNarration", v)}
          />
          <AmbienceRow
            level={ambienceLevel}
            unavailable={ambienceUnavailable}
            onChange={onChangeAmbience}
            ttsEnabled={ttsEnabled}
            duringNarrationOnly={ambienceDuringNarrationOnly}
            boostWithTTS={ambienceBoostWithTTS}
            musicLevel={ambienceMusicLevel}
            onChangeDuringNarrationOnly={onChangeAmbienceDuringNarrationOnly}
            onChangeBoostWithTTS={onChangeAmbienceBoostWithTTS}
            onChangeMusicLevel={onChangeAmbienceMusicLevel}
          />
          <TTSRow
            enabled={ttsEnabled}
            providerId={ttsProviderId}
            providerReady={ttsProviderReady}
            voiceId={ttsVoiceId}
            ttsModel={ttsModel}
            browserVoices={ttsBrowserVoices}
            voxtralVoices={ttsVoxtralVoices}
            voxtralVoicesError={ttsVoxtralVoicesError}
            rate={ttsRate}
            elevenKey={ttsElevenKey}
            azureKey={ttsAzureKey}
            azureRegion={ttsAzureRegion}
            googleKey={ttsGoogleKey}
            onChangeEnabled={onChangeTtsEnabled}
            onChangeProvider={onChangeTtsProvider}
            onChangeVoice={onChangeTtsVoice}
            onChangeModel={onChangeTtsModel}
            onChangeRate={onChangeTtsRate}
            onChangeElevenKey={onChangeTtsElevenKey}
            onChangeAzureKey={onChangeTtsAzureKey}
            onChangeAzureRegion={onChangeTtsAzureRegion}
            onChangeGoogleKey={onChangeTtsGoogleKey}
          />
          <CodexSection settings={settings} onChange={onChange} />
          <div className="settings-toggle" style={{ cursor: "default", opacity: 0.85 }}>
            <div className="flex-1 min-w-0">
              <div
                className="display-font"
                style={{
                  color: "var(--cream-dim)",
                  letterSpacing: "0.18em",
                  fontSize: 11,
                  textTransform: "uppercase"
                }}
              >
                System: reduce motion
              </div>
              <div
                className="body-font italic"
                style={{ color: "var(--cream-faint)", fontSize: 12, marginTop: 4 }}
              >
                {osReducedMotion
                  ? "On — read from your operating system. Animations are stilled and the typewriter is bypassed."
                  : "Off — your operating system is not asking for reduced motion."}
              </div>
            </div>
            <span
              className="display-font"
              style={{
                color: osReducedMotion ? "var(--rose-gold)" : "var(--cream-faint)",
                fontSize: 10,
                letterSpacing: "0.3em",
                flexShrink: 0
              }}
            >
              {osReducedMotion ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
        </div>
        <div
          className="px-6 py-4 border-t flex justify-end"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <button onClick={onClose} className="icon-btn" style={{ padding: "8px 18px" }}>
            ✕ DONE
          </button>
        </div>
      </div>
    </div>
  );
}
