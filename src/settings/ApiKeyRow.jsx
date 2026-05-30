// @ts-check
import React, { useState } from "react";
import { encryptSecret } from "../storage/encryption.js";
import { PROVIDER_META, resetProviderKey } from "../llm/providers.js";
import { requestPassphrase } from "../passphrase.js";

/**
 * @param {Object} props
 * @param {ProviderId} props.providerId
 */
export function ApiKeyRow({ providerId }) {
  const meta = PROVIDER_META[providerId];
  const [stored, setStored] = React.useState(() => !!localStorage.getItem(meta.keyStorage));
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const fieldStyle = {
    flex: 1,
    padding: "7px 9px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid rgba(232,222,197,0.22)",
    background: "rgba(22,18,21,0.9)",
    color: "var(--cream-bright)",
    fontFamily: "monospace",
    minWidth: 0
  };
  const btnStyle = {
    padding: "7px 11px",
    fontSize: 11,
    borderRadius: 6,
    border: "1px solid rgba(232,222,197,0.22)",
    background: "rgba(22,18,21,0.9)",
    color: "var(--cream-dim)",
    cursor: "pointer",
    letterSpacing: "0.14em",
    whiteSpace: "nowrap"
  };
  const saveKey = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    let passphrase = window.__sessionPassphrase;
    if (!passphrase) {
      passphrase = await requestPassphrase("Set a session passphrase to encrypt your API keys:");
      if (!passphrase) return;
      window.__sessionPassphrase = passphrase;
    }
    localStorage.setItem(meta.keyStorage, await encryptSecret(trimmed, passphrase));
    setValue("");
    setEditing(false);
    setStored(true);
  };
  const forgetKey = () => {
    resetProviderKey(providerId);
    setStored(false);
    setEditing(false);
    setValue("");
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div
        className="display-font"
        style={{ color: "var(--cream-dim)", letterSpacing: "0.14em", fontSize: 10, textTransform: "uppercase", marginBottom: 5 }}
      >
        {meta.name}
      </div>
      {stored && !editing ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            className="body-font italic"
            style={{ color: "var(--cream-faint)", fontSize: 11, flex: 1 }}
          >
            Key stored
          </span>
          <button style={btnStyle} onClick={() => setEditing(true)}>REPLACE</button>
          <button style={{ ...btnStyle, color: "rgba(200,100,100,0.8)" }} onClick={forgetKey}>FORGET</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveKey();
              if (e.key === "Escape") { setEditing(false); setValue(""); }
            }}
            placeholder={`Paste ${meta.name} API key…`}
            aria-label={`${meta.name} API key`}
            style={fieldStyle}
            autoComplete="off"
          />
          <button
            style={{ ...btnStyle, opacity: value.trim() ? 1 : 0.45, cursor: value.trim() ? "pointer" : "default" }}
            onClick={saveKey}
            disabled={!value.trim()}
          >
            SAVE
          </button>
          {stored && (
            <button style={btnStyle} onClick={() => { setEditing(false); setValue(""); }}>CANCEL</button>
          )}
        </div>
      )}
    </div>
  );
}
