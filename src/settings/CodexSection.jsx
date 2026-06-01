// @ts-check
import React, { useState } from "react";
import { IMAGE_PROVIDER_META, IMAGE_PROVIDER_ORDER, setReplicateKey, getReplicateKeyPlaintext, setLocalImageUrl, getLocalImageUrl, LOCAL_IMAGE_DEFAULT_URL } from "../llm/imaging.js";
import { PROVIDER_META, TOOL_USE_PROVIDER_ORDER } from "../llm/providers.js";
import { CODEX_MODE_OPTIONS } from "../data/constants.js";
import { ModelPicker } from "./ModelPicker.jsx";

const fieldStyle = {
  width: "100%",
  marginTop: 6,
  padding: "7px 9px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid rgba(232,222,197,0.22)",
  background: "rgba(22,18,21,0.9)",
  color: "var(--cream-bright)"
};
const subLabel = {
  color: "var(--cream-dim)", letterSpacing: "0.16em", fontSize: 10, textTransform: "uppercase", marginTop: 14
};

/**
 * @param {Object} props
 * @param {AppSettings} props.settings
 * @param {(key: string, value: any) => void} props.onChange
 */
export function CodexSection({ settings, onChange }) {
  const codex = settings.codex || /** @type {CodexSettings} */ ({});
  const mode = codex.mode || "off";
  const providerId = codex.provider || "pollinations";
  const providerCfg = (codex.providerConfig && codex.providerConfig[providerId]) || {};
  const ad = codex.artDirectorEngine || { provider: "mistral", model: "mistral-small-latest" };

  const [replicateKey, setReplicateKeyState] = useState(() => getReplicateKeyPlaintext());
  const [localUrl, setLocalUrl] = useState(() => getLocalImageUrl());

  const update = (/** @type {Partial<CodexSettings>} */ patch) => onChange("codex", { ...codex, ...patch });
  const updateProviderCfg = (/** @type {string} */ provId, /** @type {{ model?: string }} */ patch) => onChange("codex", {
    ...codex,
    providerConfig: {
      ...(codex.providerConfig || {}),
      [provId]: { ...((codex.providerConfig || {})[provId] || {}), ...patch }
    }
  });

  const modeOptions = CODEX_MODE_OPTIONS;

  return (
    <div className="settings-toggle" style={{ cursor: "default", display: "block" }}>
      <div
        className="display-font"
        style={{ color: "var(--cream-bright)", letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}
      >
        Prestige codex — illustrations
      </div>
      <div
        className="body-font italic"
        style={{ color: "var(--cream-dim)", fontSize: 12, marginTop: 4, lineHeight: 1.6 }}
      >
        Occasional plates rendered like inserts in a leather-bound manuscript. Text always arrives first; images develop in the background and never block your move.
      </div>

      <div style={subLabel}>Frequency</div>
      <div
        role="radiogroup"
        aria-label="Illustration frequency"
        style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}
      >
        {modeOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={mode === opt.id ? "true" : "false"}
            onClick={() => update({ mode: opt.id })}
            className="icon-btn"
            title={opt.hint}
            style={{
              padding: "6px 12px",
              fontSize: 10,
              letterSpacing: "0.2em",
              borderColor: mode === opt.id ? "rgba(212,165,116,0.55)" : "rgba(232,222,197,0.2)",
              color: mode === opt.id ? "var(--cream-bright)" : "var(--cream-dim)",
              background: mode === opt.id ? "rgba(212,165,116,0.08)" : "transparent"
            }}
          >
            {opt.label.toUpperCase()}
          </button>
        ))}
      </div>

      {mode !== "off" && (
        <>
          <div style={subLabel}>Image provider</div>
          <select
            value={providerId}
            aria-label="Image provider"
            onChange={(e) => update({ provider: /** @type {ImageProviderId} */ (e.target.value) })}
            style={fieldStyle}
          >
            {IMAGE_PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>{IMAGE_PROVIDER_META[/** @type {ImageProviderId} */ (id)].name}</option>
            ))}
          </select>
          <div
            className="body-font italic"
            style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 4 }}
          >
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
              <div style={subLabel}>Replicate API key</div>
              <input
                type="password"
                value={replicateKey}
                onChange={(e) => { setReplicateKeyState(e.target.value); setReplicateKey(e.target.value); }}
                placeholder="r8_..."
                autoComplete="off"
                style={fieldStyle}
              />
              <div
                className="body-font italic"
                style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 4 }}
              >
                Stored locally in plaintext. For encrypted-at-rest storage, set REPLICATE_API_KEY on window or as a meta tag.
              </div>
            </>
          )}

          {providerId === "openai" && (
            <div
              className="body-font italic"
              style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 4 }}
            >
              Uses your saved OpenAI API key. gpt-image-1 is the current flagship (needs org verification, ~$0.011–0.167/image). dall-e-3 is broadly available (~$0.04/image). dall-e-2 is cheapest legacy.
            </div>
          )}

          {providerId === "local" && (
            <>
              <div style={subLabel}>Endpoint URL</div>
              <input
                type="text"
                value={localUrl}
                onChange={(e) => { setLocalUrl(e.target.value); setLocalImageUrl(e.target.value); }}
                placeholder={LOCAL_IMAGE_DEFAULT_URL}
                style={fieldStyle}
              />
              <div
                className="body-font italic"
                style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 4 }}
              >
                A1111-compatible txt2img endpoint (default). Returns base64 images.
              </div>
            </>
          )}

          <div style={subLabel}>Art Director — provider</div>
          <select
            value={ad.provider}
            aria-label="Art Director provider"
            onChange={(e) => {
              const prov = e.target.value;
              const model = PROVIDER_META[/** @type {ProviderId} */ (prov)]?.models?.[0]?.id || ad.model;
              update({ artDirectorEngine: { provider: prov, model } });
            }}
            style={fieldStyle}
          >
            {TOOL_USE_PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>{PROVIDER_META[/** @type {ProviderId} */ (id)].name}</option>
            ))}
          </select>
          <ModelPicker
            label="Art Director — model"
            presets={PROVIDER_META[/** @type {ProviderId} */ (ad.provider)]?.models || []}
            value={ad.model}
            onChange={(m) => update({ artDirectorEngine: { ...ad, model: m } })}
          />
          <div
            className="body-font italic"
            style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 4 }}
          >
            A small, cheap LLM is best — its only job is to gate plates and write tight visual briefs.
          </div>

          <div style={subLabel}>Per-session plate cap</div>
          <input
            type="number"
            min={0}
            max={60}
            step={1}
            value={codex.maxPerSession ?? 12}
            onChange={(e) => update({ maxPerSession: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)) })}
            style={fieldStyle}
          />
          <div
            className="body-font italic"
            style={{ color: "var(--cream-faint)", fontSize: 11, marginTop: 4 }}
          >
            Hard ceiling on illustrations per session. After the cap, the Art Director still runs but no images are requested.
          </div>
        </>
      )}
    </div>
  );
}
