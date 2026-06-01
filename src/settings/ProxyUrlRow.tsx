import React, { useState } from "react";

interface ProxyUrlRowProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * "Bring Your Own Backend" proxy endpoint. When set, every model request is
 * routed through this URL and the browser-held key headers are stripped, so the
 * secret never crosses the wire — the proxy attaches its own credentials.
 *
 * Mirrors the saved value in local state and commits on blur, so the global
 * settings store isn't rewritten on every keystroke.
 */
export function ProxyUrlRow({ value, onChange }: ProxyUrlRowProps) {
  const [draft, setDraft] = useState(value || "");

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      alert("Proxy URL must start with http:// or https://");
      setDraft(value || "");
      return;
    }
    if (trimmed !== (value || "")) onChange(trimmed);
    setDraft(trimmed);
  };

  return (
    <div className="mt-3">
      <div className="display-font text-cream-dim tracking-display text-[10px] uppercase mb-[5px]">
        System: proxy URL
      </div>
      <div className="body-font italic text-cream-faint text-[11px] leading-normal mb-1">
        Route every model request through your own backend instead of calling the provider directly. Your API key headers are stripped before the request leaves the browser — your proxy is expected to attach the real credentials server-side. Leave blank to call providers directly.
      </div>
      <input
        type="url"
        value={draft}
        placeholder="https://your-proxy.example.com/llm"
        aria-label="Proxy URL"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className="field-settings w-full mt-1"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
