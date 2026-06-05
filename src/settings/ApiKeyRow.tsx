import type { ProviderId } from "../types";
import React from "react";
import { encryptWithKey } from "../storage/encryption";
import { PROVIDER_META, resetProviderKey, checkProviderHealth } from "../llm/providers";
import { usePassphrase } from "../context/PassphraseContext";
import { BTN_SETTINGS, FIELD_SETTINGS } from "../components/ui/styleClasses";

interface ApiKeyRowProps {
  providerId: ProviderId;
}

export function ApiKeyRow({ providerId }: ApiKeyRowProps) {
  const meta = PROVIDER_META[providerId];
  const { requestPassphrase, getSessionKey, setSessionKeyFromPassphrase, isUnlocked } = usePassphrase();
  const [stored, setStored] = React.useState(() => !!localStorage.getItem(meta.keyStorage));
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; detail: string } | null>(null);
  const saveKey = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!isUnlocked()) {
      const pass = await requestPassphrase("Set a session passphrase to encrypt your API keys:");
      if (!pass) return;
      await setSessionKeyFromPassphrase(pass);
    }
    const key = getSessionKey();
    if (!key) return;
    localStorage.setItem(meta.keyStorage, await encryptWithKey(key, trimmed));
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
      <div className="font-display font-medium text-cream-dim tracking-display text-[10px] uppercase mb-[5px]">
        {meta.name}
      </div>
      {stored && !editing ? (
        <div>
          <div className="flex gap-1.5 items-center">
            <span className="font-body italic text-cream-faint text-[11px] flex-1">
              Key stored
            </span>
            <button className={BTN_SETTINGS} onClick={testKey} disabled={testing}>
              {testing ? "TESTING…" : "TEST"}
            </button>
            <button className={BTN_SETTINGS} onClick={() => setEditing(true)}>REPLACE</button>
            <button className={`${BTN_SETTINGS} !text-[rgba(200,100,100,0.8)]`} onClick={forgetKey}>FORGET</button>
          </div>
          {testResult && (
            <div className={`font-body text-[10px] mt-1 leading-normal ${testResult.ok ? "text-[rgba(120,200,120,0.85)]" : "text-[rgba(200,120,100,0.85)]"}`}>
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
            className={FIELD_SETTINGS}
            autoComplete="off"
          />
          <button
            className={BTN_SETTINGS}
            onClick={saveKey}
            disabled={!value.trim()}
          >
            SAVE
          </button>
          {stored && (
            <button className={BTN_SETTINGS} onClick={() => { setEditing(false); setValue(""); }}>CANCEL</button>
          )}
        </div>
      )}
    </div>
  );
}
