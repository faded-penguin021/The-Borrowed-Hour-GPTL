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
  const fieldStyle = {
    flex: 1,
    padding: "7px 9px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid rgba(232,222,197,0.22)",
    background: "rgba(22,18,21,0.9)",
    color: "var(--cream-bright)",
    fontFamily: "monospace",
    minWidth: 0,
    width: "100%",
    marginTop: 4
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
    <div style={{ marginTop: 12 }}>
      <div
        className="display-font"
        style={{ color: "var(--cream-dim)", letterSpacing: "0.14em", fontSize: 10, textTransform: "uppercase", marginBottom: 5 }}
      >
        Local LLM
      </div>
      <div
        className="body-font italic"
        style={{ color: "var(--cream-faint)", fontSize: 11, lineHeight: 1.5, marginBottom: 4 }}
      >
        Paste the chat-completions endpoint of your local server (Ollama, LM Studio, llama.cpp). No API key required for most local setups. For Ollama, start it with OLLAMA_ORIGINS=* to allow browser access.
      </div>
      <input
        type="text"
        value={url}
        placeholder={LOCAL_DEFAULT_URL}
        aria-label="Local LLM endpoint URL"
        onChange={(e) => setUrl(e.target.value)}
        onBlur={(e) => saveUrl(e.target.value)}
        style={fieldStyle}
        autoComplete="off"
        spellCheck={false}
      />
      <div
        className="display-font"
        style={{ color: "var(--cream-faint)", letterSpacing: "0.12em", fontSize: 10, textTransform: "uppercase", marginTop: 8, marginBottom: 4 }}
      >
        Bearer token (optional)
      </div>
      {keyStored && !editingKey ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            className="body-font italic"
            style={{ color: "var(--cream-faint)", fontSize: 11, flex: 1 }}
          >
            Token stored
          </span>
          <button style={btnStyle} onClick={() => setEditingKey(true)}>REPLACE</button>
          <button style={{ ...btnStyle, color: "rgba(200,100,100,0.8)" }} onClick={forgetKey}>FORGET</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
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
            style={{ ...fieldStyle, marginTop: 0 }}
            autoComplete="off"
          />
          <button
            style={{ ...btnStyle, opacity: key.trim() ? 1 : 0.45, cursor: key.trim() ? "pointer" : "default" }}
            onClick={saveKey}
            disabled={!key.trim()}
          >
            SAVE
          </button>
          {keyStored && (
            <button style={btnStyle} onClick={() => { setEditingKey(false); setKey(""); }}>CANCEL</button>
          )}
        </div>
      )}
    </div>
  );
}
