import React from "react";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue";
import { ModelPicker } from "./ModelPicker";

interface TTSVoiceOption {
  id: string;
  label: string;
}

interface TTSRowProps {
  enabled: boolean;
  providerId: string | null;
  providerReady: Record<string, boolean>;
  voiceId: string | null;
  ttsModel?: string | null;
  browserVoices?: SpeechSynthesisVoice[];
  voxtralVoices?: TTSVoiceOption[];
  voxtralVoicesError?: string | null;
  rate: number;
  elevenKey?: string;
  azureKey?: string;
  azureRegion?: string;
  googleKey?: string;
  onChangeEnabled: (v: boolean) => void;
  onChangeProvider: (id: string) => void;
  onChangeVoice: (id: string | null) => void;
  onChangeModel: (id: string) => void;
  onChangeRate: (v: number) => void;
  onChangeElevenKey: (key: string) => Promise<void>;
  onChangeAzureKey: (key: string) => Promise<void>;
  onChangeAzureRegion: (region: string) => void;
  onChangeGoogleKey: (key: string) => Promise<void>;
  onChangeOpenAIKey?: (key: string) => Promise<void>;
  onChangeMistralKey?: (key: string) => Promise<void>;
}

export function TTSRow({ enabled, providerId, providerReady, voiceId, ttsModel, browserVoices, voxtralVoices, voxtralVoicesError, rate, elevenKey, azureKey, azureRegion, googleKey, onChangeEnabled, onChangeProvider, onChangeVoice, onChangeModel, onChangeRate, onChangeElevenKey, onChangeAzureKey, onChangeAzureRegion, onChangeGoogleKey, onChangeOpenAIKey, onChangeMistralKey }: TTSRowProps) {
  const [elevenInput, setElevenInput] = React.useState(elevenKey || "");
  const [elevenSaved, setElevenSaved] = React.useState(false);
  const [azureInput, setAzureInput] = React.useState(azureKey || "");
  const [azureSaved, setAzureSaved] = React.useState(false);
  const [azureRegionInput, setAzureRegionInput] = React.useState(azureRegion || "eastus");
  const [azureRegionSaved, setAzureRegionSaved] = React.useState(false);
  const [googleInput, setGoogleInput] = React.useState(googleKey || "");
  const [googleSaved, setGoogleSaved] = React.useState(false);
  const [openaiInput, setOpenaiInput] = React.useState("");
  const [openaiSaved, setOpenaiSaved] = React.useState(false);
  const [mistralInput, setMistralInput] = React.useState("");
  const [mistralSaved, setMistralSaved] = React.useState(false);
  const providers = TTS_PROVIDER_ORDER.map((id) => TTS_PROVIDER_META[id]);
  const ready = providerReady || {};
  const activeMeta = providerId ? TTS_PROVIDER_META[providerId] || null : null;
  const voices = providerId === "browser"
    ? (browserVoices || []).map((v) => ({ id: v.name, label: `${v.name} — ${v.lang}` }))
    : providerId === "voxtral"
      ? (voxtralVoices && voxtralVoices.length > 0 ? voxtralVoices : (activeMeta?.voices || []))
      : (activeMeta?.voices || []);
  const allowCustomVoiceId = !!activeMeta?.allowCustomVoiceId;
  return (
    <div
      className="settings-toggle"
      style={{ cursor: "default", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}
    >
      <div className="flex-1 min-w-0" style={{ width: "100%" }}>
        <div
          className="display-font"
          style={{ color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}
        >
          Narration aloud
        </div>
        <div
          className="body-font italic"
          style={{ color: "var(--cream-dim)", fontSize: 12, marginTop: 4, marginBottom: 10 }}
        >
          Read each turn's narration aloud. Providers marked Ready use a key you've already set.
        </div>
        <label
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}
        >
          <input
            type="checkbox"
            checked={!!enabled}
            onChange={(e) => onChangeEnabled(e.target.checked)}
            style={{ accentColor: "var(--rose-gold)" }}
          />
          <span
            className="display-font"
            style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--cream-bright)" }}
          >
            {enabled ? "READING ALOUD" : "SILENT"}
          </span>
        </label>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: enabled ? 10 : 0 }}
        >
          {providers.map((p) => {
            const isReady = !p.requiresKey || ready[p.id];
            const isActive = providerId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChangeProvider(p.id)}
                className="icon-btn"
                title={p.requiresKey && !isReady
                  ? (p.reusesLLMKey ? `Set the ${p.reusesLLMKey === "openai" ? "OpenAI" : p.reusesLLMKey === "mistral" ? "Mistral" : p.reusesLLMKey} key in Settings → API keys`
                    : p.id === "azure" ? "Enter your Azure Speech key below"
                    : p.id === "google" ? "Enter your Google Cloud key below"
                    : "Enter your ElevenLabs key below")
                  : p.name}
                style={{
                  padding: "5px 10px",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  borderColor: isActive ? "rgba(212, 165, 116, 0.55)" : "rgba(232, 222, 197, 0.2)",
                  color: isActive ? "var(--cream-bright)" : "var(--cream-dim)",
                  background: isActive ? "rgba(212, 165, 116, 0.08)" : "transparent"
                }}
              >
                {p.name.toUpperCase()}
                <span
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.2em",
                    padding: "1px 4px",
                    borderRadius: 2,
                    background: isReady ? "rgba(212,165,116,0.15)" : "rgba(232,222,197,0.06)",
                    color: isReady ? "var(--rose-gold)" : "var(--cream-faint)"
                  }}
                >
                  {isReady ? "READY" : "NEEDS KEY"}
                </span>
              </button>
            );
          })}
        </div>
        {providerId === "elevenlabs" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            <input
              type="password"
              value={elevenInput}
              onChange={(e) => { setElevenInput(e.target.value); setElevenSaved(false); }}
              placeholder="ElevenLabs API key…"
              className="body-font"
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }}
            />
            <button
              className="icon-btn"
              style={{ padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" }}
              onClick={async () => { await onChangeElevenKey(elevenInput); setElevenSaved(true); }}
            >
              {elevenSaved ? "SAVED ✓" : "SAVE"}
            </button>
          </div>
        )}
        {providerId === "azure" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="password"
                value={azureInput}
                onChange={(e) => { setAzureInput(e.target.value); setAzureSaved(false); }}
                placeholder="Azure Speech API key…"
                className="body-font"
                style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }}
              />
              <button
                className="icon-btn"
                style={{ padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" }}
                onClick={async () => { await onChangeAzureKey(azureInput); setAzureSaved(true); }}
              >
                {azureSaved ? "SAVED ✓" : "SAVE"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={azureRegionInput}
                onChange={(e) => { setAzureRegionInput(e.target.value); setAzureRegionSaved(false); }}
                placeholder="Region (e.g. eastus)…"
                className="body-font"
                style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }}
              />
              <button
                className="icon-btn"
                style={{ padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" }}
                onClick={() => { onChangeAzureRegion(azureRegionInput); setAzureRegionSaved(true); }}
              >
                {azureRegionSaved ? "SAVED ✓" : "SAVE"}
              </button>
            </div>
          </div>
        )}
        {providerId === "google" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            <input
              type="password"
              value={googleInput}
              onChange={(e) => { setGoogleInput(e.target.value); setGoogleSaved(false); }}
              placeholder="Google Cloud TTS API key…"
              className="body-font"
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }}
            />
            <button
              className="icon-btn"
              style={{ padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" }}
              onClick={async () => { await onChangeGoogleKey(googleInput); setGoogleSaved(true); }}
            >
              {googleSaved ? "SAVED ✓" : "SAVE"}
            </button>
          </div>
        )}
        {providerId === "openai" && (
          ready["openai"] ? (
            <div
              className="body-font italic"
              style={{ color: "var(--cream-dim)", fontSize: 11, marginBottom: 8 }}
            >
              OpenAI key is set. To update it, go to <b>Settings → System → API Keys</b>.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <input
                type="password"
                value={openaiInput}
                onChange={(e) => { setOpenaiInput(e.target.value); setOpenaiSaved(false); }}
                placeholder="OpenAI API key…"
                className="body-font"
                style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }}
              />
              <button
                className="icon-btn"
                style={{ padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" }}
                onClick={async () => { if (onChangeOpenAIKey) { await onChangeOpenAIKey(openaiInput); setOpenaiSaved(true); } }}
              >
                {openaiSaved ? "SAVED ✓" : "SAVE"}
              </button>
            </div>
          )
        )}
        {providerId === "voxtral" && (
          ready["voxtral"] ? (
            <div
              className="body-font italic"
              style={{ color: "var(--cream-dim)", fontSize: 11, marginBottom: 8 }}
            >
              Mistral key is set. To update it, go to <b>Settings → System → API Keys</b>.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <input
                type="password"
                value={mistralInput}
                onChange={(e) => { setMistralInput(e.target.value); setMistralSaved(false); }}
                placeholder="Mistral API key…"
                className="body-font"
                style={{ flex: 1, background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12 }}
              />
              <button
                className="icon-btn"
                style={{ padding: "5px 10px", fontSize: 10, letterSpacing: "0.15em" }}
                onClick={async () => { if (onChangeMistralKey) { await onChangeMistralKey(mistralInput); setMistralSaved(true); } }}
              >
                {mistralSaved ? "SAVED ✓" : "SAVE"}
              </button>
            </div>
          )
        )}
        {enabled && providerId === "voxtral" && voxtralVoicesError && (
          <div
            className="body-font italic"
            style={{ color: "var(--rose-ember)", fontSize: 11, marginBottom: 6, opacity: 0.85 }}
          >
            Voice list: {voxtralVoicesError}
          </div>
        )}
        {enabled && providerId === "voxtral" && !voxtralVoicesError && (!voxtralVoices || voxtralVoices.length === 0) && (
          <div
            className="body-font italic"
            style={{ color: "var(--cream-faint)", fontSize: 11, marginBottom: 6 }}
          >
            Loading voice list…
          </div>
        )}
        {enabled && voices.length > 0 && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            <span
              className="display-font"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-dim)" }}
            >
              VOICE
            </span>
            <select
              value={voiceId && voices.some((v) => v.id === voiceId) ? voiceId : ""}
              onChange={(e) => onChangeVoice(e.target.value || null)}
              className="body-font"
              style={{ background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "6px 10px", fontSize: 13, maxWidth: "100%" }}
            >
              {providerId === "browser" && <option value="">Automatic</option>}
              {allowCustomVoiceId && voiceId && !voices.some((v) => v.id === voiceId) && (
                <option value={voiceId}>{`Custom — ${voiceId.slice(0, 16)}…`}</option>
              )}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </label>
        )}
        {enabled && allowCustomVoiceId && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            <span
              className="display-font"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-dim)" }}
            >
              CUSTOM VOICE ID
            </span>
            <input
              type="text"
              value={voiceId || ""}
              onChange={(e) => onChangeVoice(e.target.value.trim() || null)}
              placeholder={providerId === "voxtral"
                ? "Paste any Voxtral voice id (e.g. en_paul_neutral) or cloned voice id"
                : "Paste any ElevenLabs voice ID (e.g. cloned voice)"}
              className="body-font"
              autoComplete="off"
              spellCheck={false}
              style={{ background: "rgba(0,0,0,0.3)", color: "var(--cream-bright)", border: "1px solid rgba(232,222,197,0.2)", padding: "5px 8px", fontSize: 12, fontFamily: "monospace" }}
            />
          </label>
        )}
        {enabled && (activeMeta?.models?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 8 }}>
            <ModelPicker
              label="Model"
              presets={activeMeta?.models || []}
              value={ttsModel || activeMeta?.model || ""}
              onChange={onChangeModel}
            />
          </div>
        )}
        {enabled && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              className="display-font"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-dim)" }}
            >
              {`READING PACE — ${(rate || 1).toFixed(2)}×`}
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={rate}
              onChange={(e) => onChangeRate(parseFloat(e.target.value))}
              style={{ accentColor: "var(--rose-gold)" }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
