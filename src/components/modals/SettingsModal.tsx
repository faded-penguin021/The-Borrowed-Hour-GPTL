import React, { useRef, useState } from "react";
import { ApiKeysSection } from "../../settings/ApiKeysSection";
import { EngineSection } from "../../settings/EngineSection";
import { AmbienceRow } from "../../settings/AmbienceRow";
import { TTSRow } from "../../settings/TTSRow";
import { SettingsToggleRow } from "../../settings/SettingsToggleRow";
import { ProxyUrlRow } from "../../settings/ProxyUrlRow";
import { CodexSection } from "../../settings/CodexSection";
import { useSettingsContext } from "../../context/SettingsContext";
import { useAmbienceContext } from "../../context/AmbienceContext";
import { useTTSContext } from "../../context/TTSContext";
import { PROVIDER_META } from "../../llm/providers";
import { TTS_PROVIDER_META } from "../../tts/catalogue";

type SettingsTabId = "reading" | "audio" | "codex" | "system" | "proxy";

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: "reading", label: "Reading" },
  { id: "audio", label: "Audio" },
  { id: "codex", label: "Codex" },
  { id: "system", label: "System" },
  { id: "proxy", label: "Proxy" },
];

/**
 * Reads reading/display settings, ambience, and TTS straight from their
 * contexts; the only prop is the modal close handler.
 */
export function SettingsModal({ onClose }: { onClose: () => void }) {
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
  const ttsModelOverridesMap = ttsModelOverrides as Record<string, string>;
  const ttsModel = ttsProviderId ? (ttsModelOverridesMap[ttsProviderId] || null) : null;
  const onChangeTtsEnabled = setTtsEnabled;
  const onChangeTtsProvider = (id: string) => {
    setTtsProviderId(id);
    const meta = TTS_PROVIDER_META[id];
    setTtsVoiceId(meta?.voices?.[0]?.id ?? null);
  };
  const onChangeTtsVoice = setTtsVoiceId;
  const onChangeTtsRate = setTtsRate;
  const onChangeTtsModel = (m: string | null) => {
    if (!ttsProviderId) return;
    setTtsModelOverrides((prev: Record<string, string>) => {
      const next = { ...prev };
      if (m) next[ttsProviderId] = m; else delete next[ttsProviderId];
      return next;
    });
  };
  const onChangeTtsElevenKey = async (k: string) => { setTtsElevenKey(k); await saveTtsElevenLabsKey(k); detectTtsProviderReady(); };
  const onChangeTtsAzureKey = async (k: string) => { setTtsAzureKey(k); await saveTtsAzureKey(k); detectTtsProviderReady(); };
  const onChangeTtsAzureRegion = (r: string) => { setTtsAzureRegion(r); saveTtsAzureRegion(r); };
  const onChangeTtsGoogleKey = async (k: string) => { setTtsGoogleKey(k); await saveTtsGoogleKey(k); detectTtsProviderReady(); };
  const onChangeTtsOpenAIKey = async (k: string) => {
    if (k) localStorage.setItem(PROVIDER_META.openai.keyStorage, k.trim());
    else localStorage.removeItem(PROVIDER_META.openai.keyStorage);
    detectTtsProviderReady();
  };
  const onChangeTtsMistralKey = async (k: string) => {
    if (k) localStorage.setItem(PROVIDER_META.mistral.keyStorage, k.trim());
    else localStorage.removeItem(PROVIDER_META.mistral.keyStorage);
    detectTtsProviderReady();
  };

  const [activeTab, setActiveTab] = useState<SettingsTabId>("reading");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  /**
   * ARIA tablist keyboard nav: Left/Right (and Home/End) move focus *and*
   * selection between tabs, wrapping at the ends.
   */
  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const nextTab = TABS[next];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="px-6 py-5 border-b flex items-center justify-between shrink-0"
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
        <div
          className="settings-tablist px-6 pt-3 border-b shrink-0"
          role="tablist"
          aria-label="Settings sections"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className="settings-tab"
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-6 py-5">
          {/* All panels stay mounted; the `hidden` attribute hides the inactive
              ones so half-typed inputs (e.g. a Proxy URL) survive a tab switch. */}
          <div
            id="settings-panel-reading"
            role="tabpanel"
            aria-labelledby="settings-tab-reading"
            hidden={activeTab !== "reading"}
            className="space-y-3"
          >
            <p
              className="body-font italic text-sm"
              style={{ color: "var(--cream-dim)", lineHeight: 1.6 }}
            >
              The hour is told in cream-and-twilight by default. If that's hard on your reading, soften the rules below. Your choices are kept between sessions.
            </p>
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
            <SettingsToggleRow
              id="setting-debug-overlay"
              label="Debug log overlay"
              description="Show a floating DEBUG button that opens an on-screen, copyable log of console output and errors. Useful for reporting problems on devices without developer tools."
              value={settings.debugOverlay}
              onChange={(v) => onChange("debugOverlay", v)}
            />
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
            id="settings-panel-audio"
            role="tabpanel"
            aria-labelledby="settings-tab-audio"
            hidden={activeTab !== "audio"}
            className="space-y-3"
          >
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
              onChangeOpenAIKey={onChangeTtsOpenAIKey}
              onChangeMistralKey={onChangeTtsMistralKey}
            />
          </div>

          <div
            id="settings-panel-codex"
            role="tabpanel"
            aria-labelledby="settings-tab-codex"
            hidden={activeTab !== "codex"}
            className="space-y-3"
          >
            <CodexSection settings={settings} onChange={onChange} />
          </div>

          <div
            id="settings-panel-system"
            role="tabpanel"
            aria-labelledby="settings-tab-system"
            hidden={activeTab !== "system"}
            className="space-y-3"
          >
            <EngineSection settings={settings} onChange={onChange} />
            <ApiKeysSection />
          </div>

          <div
            id="settings-panel-proxy"
            role="tabpanel"
            aria-labelledby="settings-tab-proxy"
            hidden={activeTab !== "proxy"}
            className="space-y-3"
          >
            <ProxyUrlRow value={settings.proxyUrl} onChange={(v) => onChange("proxyUrl", v)} />
          </div>
        </div>
        <div
          className="px-6 py-4 border-t flex justify-end shrink-0"
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
