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
    <div className="mt-3">
      <div className="display-font text-cream-dim tracking-display text-[10px] uppercase mb-[5px]">
        {meta.name}
      </div>
      {stored && !editing ? (
        <div className="flex gap-1.5 items-center">
          <span className="body-font italic text-cream-faint text-[11px] flex-1">
            Key stored
          </span>
          <button className="btn-settings" onClick={() => setEditing(true)}>REPLACE</button>
          <button className="btn-settings !text-[rgba(200,100,100,0.8)]" onClick={forgetKey}>FORGET</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
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
            className="field-settings"
            autoComplete="off"
          />
          <button
            className="btn-settings"
            style={{ opacity: value.trim() ? 1 : 0.45, cursor: value.trim() ? "pointer" : "default" }}
            onClick={saveKey}
            disabled={!value.trim()}
          >
            SAVE
          </button>
          {stored && (
            <button className="btn-settings" onClick={() => { setEditing(false); setValue(""); }}>CANCEL</button>
          )}
        </div>
      )}
    </div>
  );
}
