import type { ProviderId } from "../types";
import React from "react";
import { encryptSecret } from "../storage/encryption";
import { PROVIDER_META, resetProviderKey, checkProviderHealth } from "../llm/providers";
import { requestPassphrase, getSessionPassphrase, setSessionPassphrase } from "../passphrase";

interface ApiKeyRowProps {
  providerId: ProviderId;
}

export function ApiKeyRow({ providerId }: ApiKeyRowProps) {
  const meta = PROVIDER_META[providerId];
  const [stored, setStored] = React.useState(() => !!localStorage.getItem(meta.keyStorage));
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; detail: string } | null>(null);
  const saveKey = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    let passphrase = getSessionPassphrase();
    if (!passphrase) {
      passphrase = await requestPassphrase("Set a session passphrase to encrypt your API keys:");
      if (!passphrase) return;
      setSessionPassphrase(passphrase);
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
    setTestResult(null);
  };
  const testKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await checkProviderHealth(providerId);
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, detail: "Health check threw unexpectedly." });
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="mt-3">
      <div className="display-font text-cream-dim tracking-display text-[10px] uppercase mb-[5px]">
        {meta.name}
      </div>
      {stored && !editing ? (
        <div>
          <div className="flex gap-1.5 items-center">
            <span className="body-font italic text-cream-faint text-[11px] flex-1">
              Key stored
            </span>
            <button className="btn-settings" onClick={testKey} disabled={testing}>
              {testing ? "TESTING…" : "TEST"}
            </button>
            <button className="btn-settings" onClick={() => setEditing(true)}>REPLACE</button>
            <button className="btn-settings !text-[rgba(200,100,100,0.8)]" onClick={forgetKey}>FORGET</button>
          </div>
          {testResult && (
            <div className="body-font text-[10px] mt-1 leading-normal" style={{ color: testResult.ok ? "rgba(120,200,120,0.85)" : "rgba(200,120,100,0.85)" }}>
              {testResult.detail}
            </div>
          )}
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
