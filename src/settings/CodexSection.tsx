import type { AppSettings, CodexSettings, ImageProviderId, ProviderId } from "../types";
import React, { useState } from "react";
import { IMAGE_PROVIDER_META, IMAGE_PROVIDER_ORDER, setReplicateKey, getReplicateKeyPlaintext, setLocalImageUrl, getLocalImageUrl, LOCAL_IMAGE_DEFAULT_URL, OPENAI_IMAGE_SIZES, OPENAI_IMAGE_QUALITIES, OPENAI_IMAGE_FORMATS, OPENAI_IMAGE_DEFAULT_SIZE, OPENAI_IMAGE_DEFAULT_QUALITY, OPENAI_IMAGE_DEFAULT_FORMAT } from "../llm/imaging";
import { PROVIDER_META, TOOL_USE_PROVIDER_ORDER } from "../llm/providers";
import { CODEX_MODE_OPTIONS } from "../data/constants";
import { ModelPicker } from "./ModelPicker";
import { IconButton } from "../components/ui/IconButton";

const fieldClass = "w-full mt-1.5 px-[9px] py-[7px] text-[12px] rounded-md border border-cream/[0.22] bg-[#161215]/90 text-cream-bright";
const subLabelClass = "font-display font-medium text-cream-dim tracking-[0.16em] text-[10px] uppercase mt-[14px]";

interface CodexSectionProps {
  settings: AppSettings;
  onChange: (key: string, value: unknown) => void;
}

export function CodexSection({ settings, onChange }: CodexSectionProps) {
  const codex = settings.codex || ({} as CodexSettings);
  const mode = codex.mode || "off";
  const providerId = codex.provider || "pollinations";
  const providerCfg = (codex.providerConfig && codex.providerConfig[providerId]) || {};
  const ad = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };

  const [replicateKey, setReplicateKeyState] = useState(() => getReplicateKeyPlaintext());
  const [localUrl, setLocalUrl] = useState(() => getLocalImageUrl());

  // The OpenAI image provider carries extra tunables beyond `model`; read them
  // off the shared provider-config bag (typed loosely here, validated for real
  // in the imaging adapter).
  const openaiCfg = providerCfg as { size?: string; quality?: string; output_format?: string };

  const update = (patch: Partial<CodexSettings>) => onChange("codex", { ...codex, ...patch });
  const updateProviderCfg = (provId: string, patch: Record<string, string>) => onChange("codex", {
    ...codex,
    providerConfig: {
      ...(codex.providerConfig || {}),
      [provId]: { ...((codex.providerConfig || {})[provId] || {}), ...patch }
    }
  });

  const modeOptions = CODEX_MODE_OPTIONS;

  return (
    <div className="block px-4 py-3 border border-cream/10 bg-[#1c162c]/40 transition-[border-color] duration-[250ms] cursor-default text-left w-full hover:border-rose-gold/30">
      <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
        Prestige codex — illustrations
      </div>
      <div className="font-body italic text-cream-dim text-[12px] mt-1 leading-[1.6]">
        Occasional plates rendered like inserts in a leather-bound manuscript. Text always arrives first; images develop in the background and never block your move.
      </div>

      <div className={subLabelClass}>Frequency</div>
      <div
        role="radiogroup"
        aria-label="Illustration frequency"
        className="flex gap-1.5 mt-1.5 flex-wrap"
      >
        {modeOptions.map((opt) => (
          <IconButton
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={mode === opt.id ? "true" : "false"}
            onClick={() => update({ mode: opt.id })}
            title={opt.hint}
            pad="px-3 py-1.5"
            className="text-[10px] tracking-[0.2em]"
            active={mode === opt.id}
          >
            {opt.label.toUpperCase()}
          </IconButton>
        ))}
      </div>

      {mode !== "off" && (
        <>
          <div className={subLabelClass}>Image provider</div>
          <select
            value={providerId}
            aria-label="Image provider"
            onChange={(e) => update({ provider: (e.target.value as ImageProviderId) })}
            className={fieldClass}
          >
            {IMAGE_PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>{IMAGE_PROVIDER_META[(id as ImageProviderId)].name}</option>
            ))}
          </select>
          <div className="font-body italic text-cream-faint text-[11px] mt-1">
            {IMAGE_PROVIDER_META[providerId].description}
          </div>

          {IMAGE_PROVIDER_META[providerId]?.models?.length > 0 && (
            <ModelPicker
              label="Model"
              presets={IMAGE_PROVIDER_META[providerId].models}
              value={providerCfg.model || IMAGE_PROVIDER_META[providerId].defaultModel || ""}
              onChange={(m) => updateProviderCfg(providerId, { model: m })}
            />
          )}

          {providerId === "replicate" && (
            <>
              <div className={subLabelClass}>Replicate API key</div>
              <input
                type="password"
                value={replicateKey}
                onChange={(e) => { setReplicateKeyState(e.target.value); setReplicateKey(e.target.value); }}
                placeholder="r8_..."
                autoComplete="off"
                className={fieldClass}
              />
              <div className="font-body italic text-cream-faint text-[11px] mt-1">
                Stored locally in plaintext. For encrypted-at-rest storage, set REPLICATE_API_KEY on window or as a meta tag.
              </div>
            </>
          )}

          {providerId === "openai" && (
            <>
              <div className="font-body italic text-cream-faint text-[11px] mt-1">
                Uses your saved OpenAI API key. gpt-image-1 is the value tier (~$0.011–0.040/image, needs org verification). gpt-image-2 is the flagship with improved precision and text rendering.
              </div>

              <div className={subLabelClass}>Plate size</div>
              <select
                value={openaiCfg.size || OPENAI_IMAGE_DEFAULT_SIZE}
                aria-label="OpenAI image size"
                onChange={(e) => updateProviderCfg("openai", { size: e.target.value })}
                className={fieldClass}
              >
                {OPENAI_IMAGE_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              <div className={subLabelClass}>Quality</div>
              <select
                value={openaiCfg.quality || OPENAI_IMAGE_DEFAULT_QUALITY}
                aria-label="OpenAI image quality"
                onChange={(e) => updateProviderCfg("openai", { quality: e.target.value })}
                className={fieldClass}
              >
                {OPENAI_IMAGE_QUALITIES.map((q) => (
                  <option key={q} value={q}>{q[0].toUpperCase() + q.slice(1)}</option>
                ))}
              </select>

              <div className={subLabelClass}>Output format</div>
              <select
                value={openaiCfg.output_format || OPENAI_IMAGE_DEFAULT_FORMAT}
                aria-label="OpenAI image output format"
                onChange={(e) => updateProviderCfg("openai", { output_format: e.target.value })}
                className={fieldClass}
              >
                {OPENAI_IMAGE_FORMATS.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </select>
              <div className="font-body italic text-cream-faint text-[11px] mt-1">
                Higher quality and larger sizes cost more. gpt-image-2 supports flexible aspect ratios; portrait suits a manuscript plate. Transparent backgrounds aren’t available on gpt-image-2 — use PNG on gpt-image-1 if you need them.
              </div>
            </>
          )}

          {providerId === "local" && (
            <>
              <div className={subLabelClass}>Endpoint URL</div>
              <input
                type="text"
                value={localUrl}
                onChange={(e) => { setLocalUrl(e.target.value); setLocalImageUrl(e.target.value); }}
                placeholder={LOCAL_IMAGE_DEFAULT_URL}
                className={fieldClass}
              />
              <div className="font-body italic text-cream-faint text-[11px] mt-1">
                A1111-compatible txt2img endpoint (default). Returns base64 images.
              </div>
            </>
          )}

          <div className={subLabelClass}>Art Director — provider</div>
          <select
            value={ad.provider}
            aria-label="Art Director provider"
            onChange={(e) => {
              const prov = e.target.value;
              const model = PROVIDER_META[(prov as ProviderId)]?.models?.[0]?.id || ad.model;
              update({ artDirectorEngine: { provider: prov, model } });
            }}
            className={fieldClass}
          >
            {TOOL_USE_PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>{PROVIDER_META[(id as ProviderId)].name}</option>
            ))}
          </select>
          <ModelPicker
            label="Art Director — model"
            presets={PROVIDER_META[(ad.provider as ProviderId)]?.models || []}
            value={ad.model}
            onChange={(m) => update({ artDirectorEngine: { ...ad, model: m } })}
          />
          <div className="font-body italic text-cream-faint text-[11px] mt-1">
            A small, cheap LLM is best — its only job is to gate plates and write tight visual briefs.
          </div>

          <div className={subLabelClass}>Per-session plate cap</div>
          <input
            type="number"
            min={0}
            max={60}
            step={1}
            value={codex.maxPerSession ?? 12}
            onChange={(e) => update({ maxPerSession: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)) })}
            className={fieldClass}
          />
          <div className="font-body italic text-cream-faint text-[11px] mt-1">
            Hard ceiling on illustrations per session. After the cap, the Art Director still runs but no images are requested.
          </div>
        </>
      )}
    </div>
  );
}
