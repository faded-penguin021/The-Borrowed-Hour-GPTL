// @ts-check
import React, { useState } from "react";
import { LOCAL_DEFAULT_URL } from "../data/constants.js";
import { encryptSecret } from "../storage/encryption.js";
import { PROVIDER_META } from "../llm/providers.js";
import { requestPassphrase } from "../passphrase.js";

/** No props. */
export function LocalLLMRow() {
  const meta = PROVIDER_META.local;
  const [url, setUrl] = React.useState(() => localStorage.getItem(meta.urlStorage) || "");
  const [key, setKey] = React.useState("");
  const [keyStored, setKeyStored] = React.useState(() => !!localStorage.getItem(meta.keyStorage));
  const [editingKey, setEditingKey] = React.useState(false);
  const isValidLocalUrl = (u) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?(\/.*)?$/i.test(u);
  const saveUrl = (v) => {
    const trimmed = v.trim();
    if (trimmed) {
      if (!isValidLocalUrl(trimmed)) {
        alert("Local LLM URL must point to localhost or 127.0.0.1 for security.");
        return;
      }
      localStorage.setItem(meta.urlStorage, trimmed);
    } else
      localStorage.removeItem(meta.urlStorage);
  };
  const saveKey = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    let passphrase = window.__sessionPassphrase;
    if (!passphrase) {
      passphrase = await requestPassphrase("Set a session passphrase to encrypt your API keys:");
      if (!passphrase) return;
      window.__sessionPassphrase = passphrase;
    }
    localStorage.setItem(meta.keyStorage, await encryptSecret(trimmed, passphrase));
    setKey("");
    setEditingKey(false);
    setKeyStored(true);
  };
  const forgetKey = () => {
    localStorage.removeItem(meta.keyStorage);
    setKeyStored(false);
    setEditingKey(false);
    setKey("");
  };
  return (
    <div className="mt-3">
      <div className="display-font text-cream-dim tracking-display text-[10px] uppercase mb-[5px]">
        Local LLM
      </div>
      <div className="body-font italic text-cream-faint text-[11px] leading-normal mb-1">
        Paste the chat-completions endpoint of your local server (Ollama, LM Studio, llama.cpp). No API key required for most local setups. For Ollama, start it with OLLAMA_ORIGINS=* to allow browser access.
      </div>
      <input
        type="text"
        value={url}
        placeholder={LOCAL_DEFAULT_URL}
        aria-label="Local LLM endpoint URL"
        onChange={(e) => setUrl(e.target.value)}
        onBlur={(e) => saveUrl(e.target.value)}
        className="field-settings w-full mt-1"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="display-font text-cream-faint tracking-wide text-[10px] uppercase mt-2 mb-1">
        Bearer token (optional)
      </div>
      {keyStored && !editingKey ? (
        <div className="flex gap-1.5 items-center">
          <span className="body-font italic text-cream-faint text-[11px] flex-1">
            Token stored
          </span>
          <button className="btn-settings" onClick={() => setEditingKey(true)}>REPLACE</button>
          <button className="btn-settings !text-[rgba(200,100,100,0.8)]" onClick={forgetKey}>FORGET</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveKey();
              if (e.key === "Escape") { setEditingKey(false); setKey(""); }
            }}
            placeholder="Bearer token (leave blank if not needed)"
            aria-label="Local LLM bearer token"
            className="field-settings"
            autoComplete="off"
          />
          <button
            className="btn-settings"
            style={{ opacity: key.trim() ? 1 : 0.45, cursor: key.trim() ? "pointer" : "default" }}
            onClick={saveKey}
            disabled={!key.trim()}
          >
            SAVE
          </button>
          {keyStored && (
            <button className="btn-settings" onClick={() => { setEditingKey(false); setKey(""); }}>CANCEL</button>
          )}
        </div>
      )}
    </div>
  );
}
