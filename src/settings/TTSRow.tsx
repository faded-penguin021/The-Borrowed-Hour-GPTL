import React from "react";
import { TTS_PROVIDER_META, TTS_PROVIDER_ORDER } from "../tts/catalogue";
import { ModelPicker } from "./ModelPicker";
import { IconButton } from "../components/ui/IconButton";
import { Check } from "lucide-react";

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
    <div className="flex items-start justify-between flex-wrap gap-3 px-4 py-3 border border-cream/10 bg-[#1c162c]/40 transition-[border-color] duration-[250ms] cursor-default text-left w-full hover:border-rose-gold/30">
      <div className="flex-1 min-w-0 w-full">
        <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
          Narration aloud
        </div>
        <div className="font-body italic text-cream-dim text-[12px] mt-1 mb-2.5">
          Read each turn's narration aloud. Providers marked Ready use a key you've already set.
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer mb-2.5">
          <input
            type="checkbox"
            checked={!!enabled}
            onChange={(e) => onChangeEnabled(e.target.checked)}
            className="accent-rose-gold"
          />
          <span className="font-display font-medium text-[11px] tracking-[0.2em] text-cream-bright">
            {enabled ? "READING ALOUD" : "SILENT"}
          </span>
        </label>
        <div className={`flex flex-wrap gap-1.5 ${enabled ? "mb-2.5" : ""}`}>
          {providers.map((p) => {
            const isReady = !p.requiresKey || ready[p.id];
            const isActive = providerId === p.id;
            return (
              <IconButton
                key={p.id}
                type="button"
                onClick={() => onChangeProvider(p.id)}
                title={p.requiresKey && !isReady
                  ? (p.reusesLLMKey ? `Set the ${p.reusesLLMKey === "openai" ? "OpenAI" : p.reusesLLMKey === "mistral" ? "Mistral" : p.reusesLLMKey} key in Settings → API keys`
                    : p.id === "azure" ? "Enter your Azure Speech key below"
                    : p.id === "google" ? "Enter your Google Cloud key below"
                    : "Enter your ElevenLabs key below")
                  : p.name}
                pad="px-2.5 py-[5px]"
                className="text-[10px] tracking-[0.15em] flex items-center gap-[5px]"
                active={isActive}
              >
                {p.name.toUpperCase()}
                <span
                  className={`text-[8px] tracking-[0.2em] px-1 py-px rounded-[2px] ${isReady ? "bg-rose-gold/15 text-rose-gold" : "bg-cream/[0.06] text-cream-faint"}`}
                >
                  {isReady ? "READY" : "NEEDS KEY"}
                </span>
              </IconButton>
            );
          })}
        </div>
        {providerId === "elevenlabs" && (
          <div className="flex gap-1.5 mb-2 items-center">
            <input
              type="password"
              value={elevenInput}
              onChange={(e) => { setElevenInput(e.target.value); setElevenSaved(false); }}
              placeholder="ElevenLabs API key…"
              className="font-body flex-1 bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px]"
            />
            <IconButton
              pad="px-2.5 py-[5px]"
              className="text-[10px] tracking-[0.15em]"
              onClick={async () => { await onChangeElevenKey(elevenInput); setElevenSaved(true); }}
            >
              {elevenSaved ? <>SAVED <Check size={11} strokeWidth={2}  /></> : "SAVE"}
            </IconButton>
          </div>
        )}
        {providerId === "azure" && (
          <div className="flex flex-col gap-1.5 mb-2">
            <div className="flex gap-1.5 items-center">
              <input
                type="password"
                value={azureInput}
                onChange={(e) => { setAzureInput(e.target.value); setAzureSaved(false); }}
                placeholder="Azure Speech API key…"
                className="font-body flex-1 bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px]"
              />
              <IconButton
                pad="px-2.5 py-[5px]"
                className="text-[10px] tracking-[0.15em]"
                onClick={async () => { await onChangeAzureKey(azureInput); setAzureSaved(true); }}
              >
                {azureSaved ? <>SAVED <Check size={11} strokeWidth={2}  /></> : "SAVE"}
              </IconButton>
            </div>
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                value={azureRegionInput}
                onChange={(e) => { setAzureRegionInput(e.target.value); setAzureRegionSaved(false); }}
                placeholder="Region (e.g. eastus)…"
                className="font-body flex-1 bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px]"
              />
              <IconButton
                pad="px-2.5 py-[5px]"
                className="text-[10px] tracking-[0.15em]"
                onClick={() => { onChangeAzureRegion(azureRegionInput); setAzureRegionSaved(true); }}
              >
                {azureRegionSaved ? <>SAVED <Check size={11} strokeWidth={2}  /></> : "SAVE"}
              </IconButton>
            </div>
          </div>
        )}
        {providerId === "google" && (
          <div className="flex gap-1.5 mb-2 items-center">
            <input
              type="password"
              value={googleInput}
              onChange={(e) => { setGoogleInput(e.target.value); setGoogleSaved(false); }}
              placeholder="Google Cloud TTS API key…"
              className="font-body flex-1 bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px]"
            />
            <IconButton
              pad="px-2.5 py-[5px]"
              className="text-[10px] tracking-[0.15em]"
              onClick={async () => { await onChangeGoogleKey(googleInput); setGoogleSaved(true); }}
            >
              {googleSaved ? <>SAVED <Check size={11} strokeWidth={2}  /></> : "SAVE"}
            </IconButton>
          </div>
        )}
        {providerId === "openai" && (
          ready["openai"] ? (
            <div className="font-body italic text-cream-dim text-[11px] mb-2">
              OpenAI key is set. To update it, go to <b>Settings → System → API Keys</b>.
            </div>
          ) : (
            <div className="flex gap-1.5 mb-2 items-center">
              <input
                type="password"
                value={openaiInput}
                onChange={(e) => { setOpenaiInput(e.target.value); setOpenaiSaved(false); }}
                placeholder="OpenAI API key…"
                className="font-body flex-1 bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px]"
              />
              <IconButton
                pad="px-2.5 py-[5px]"
                className="text-[10px] tracking-[0.15em]"
                onClick={async () => { if (onChangeOpenAIKey) { await onChangeOpenAIKey(openaiInput); setOpenaiSaved(true); } }}
              >
                {openaiSaved ? <>SAVED <Check size={11} strokeWidth={2}  /></> : "SAVE"}
              </IconButton>
            </div>
          )
        )}
        {providerId === "voxtral" && (
          ready["voxtral"] ? (
            <div className="font-body italic text-cream-dim text-[11px] mb-2">
              Mistral key is set. To update it, go to <b>Settings → System → API Keys</b>.
            </div>
          ) : (
            <div className="flex gap-1.5 mb-2 items-center">
              <input
                type="password"
                value={mistralInput}
                onChange={(e) => { setMistralInput(e.target.value); setMistralSaved(false); }}
                placeholder="Mistral API key…"
                className="font-body flex-1 bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px]"
              />
              <IconButton
                pad="px-2.5 py-[5px]"
                className="text-[10px] tracking-[0.15em]"
                onClick={async () => { if (onChangeMistralKey) { await onChangeMistralKey(mistralInput); setMistralSaved(true); } }}
              >
                {mistralSaved ? <>SAVED <Check size={11} strokeWidth={2}  /></> : "SAVE"}
              </IconButton>
            </div>
          )
        )}
        {enabled && providerId === "voxtral" && voxtralVoicesError && (
          <div className="font-body italic text-rose-ember text-[11px] mb-1.5 opacity-[0.85]">
            Voice list: {voxtralVoicesError}
          </div>
        )}
        {enabled && providerId === "voxtral" && !voxtralVoicesError && (!voxtralVoices || voxtralVoices.length === 0) && (
          <div className="font-body italic text-cream-faint text-[11px] mb-1.5">
            Loading voice list…
          </div>
        )}
        {enabled && voices.length > 0 && (
          <label className="flex flex-col gap-1 mb-2">
            <span className="font-display font-medium text-[10px] tracking-[0.2em] text-cream-dim">
              VOICE
            </span>
            <select
              value={voiceId && voices.some((v) => v.id === voiceId) ? voiceId : ""}
              onChange={(e) => onChangeVoice(e.target.value || null)}
              className="font-body bg-black/30 text-cream-bright border border-cream/20 py-1.5 px-2.5 text-[13px] max-w-full"
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
          <label className="flex flex-col gap-1 mb-2">
            <span className="font-display font-medium text-[10px] tracking-[0.2em] text-cream-dim">
              CUSTOM VOICE ID
            </span>
            <input
              type="text"
              value={voiceId || ""}
              onChange={(e) => onChangeVoice(e.target.value.trim() || null)}
              placeholder={providerId === "voxtral"
                ? "Paste any Voxtral voice id (e.g. en_paul_neutral) or cloned voice id"
                : "Paste any ElevenLabs voice ID (e.g. cloned voice)"}
              className="font-body bg-black/30 text-cream-bright border border-cream/20 py-[5px] px-2 text-[12px] font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        {enabled && (activeMeta?.models?.length ?? 0) > 0 && (
          <div className="mb-2">
            <ModelPicker
              label="Model"
              presets={activeMeta?.models || []}
              value={ttsModel || activeMeta?.model || ""}
              onChange={onChangeModel}
            />
          </div>
        )}
        {enabled && (
          <label className="flex flex-col gap-1">
            <span className="font-display font-medium text-[10px] tracking-[0.2em] text-cream-dim">
              {`READING PACE — ${(rate || 1).toFixed(2)}×`}
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={rate}
              onChange={(e) => onChangeRate(parseFloat(e.target.value))}
              className="accent-rose-gold"
            />
          </label>
        )}
      </div>
    </div>
  );
}
