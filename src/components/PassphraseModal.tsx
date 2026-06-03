import React, { useState, useEffect, useRef } from "react";
import { usePassphrase } from "../context/PassphraseContext";
import { Lock } from "lucide-react";

export function PassphraseModal() {
  const { prompt, pending, resolvePassphrase } = usePassphrase();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending) setValue("");
  }, [pending]);

  useEffect(() => {
    if (pending && inputRef.current) inputRef.current.focus();
  }, [pending]);

  if (!pending) return null;

  const submit = () => {
    const trimmed = value.trim();
    resolvePassphrase(trimmed || null);
  };
  const cancel = () => resolvePassphrase(null);

  return (
    <div className="modal-backdrop" onClick={cancel}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <div
            className="display-font text-[10px] mb-1"
            style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
          >
            <Lock size={12} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />PASSPHRASE
          </div>
          <h2
            className="display-font text-base"
            style={{ color: "var(--cream-bright)", letterSpacing: "0.04em" }}
          >
            {prompt}
          </h2>
        </div>
        <div className="px-6 py-5">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") cancel();
            }}
            placeholder="Passphrase…"
            aria-label="Session passphrase"
            autoComplete="off"
            className="w-full body-font text-sm"
            style={{
              padding: "10px 12px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(232, 222, 197, 0.15)",
              borderRadius: 6,
              color: "var(--cream-bright)",
            }}
          />
        </div>
        <div
          className="px-6 py-4 border-t flex justify-end gap-3"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <button onClick={cancel} className="icon-btn" style={{ padding: "8px 18px" }}>
            CANCEL
          </button>
          <button
            onClick={submit}
            className="icon-btn"
            style={{ padding: "8px 18px", opacity: value.trim() ? 1 : 0.45 }}
            disabled={!value.trim()}
          >
            UNLOCK
          </button>
        </div>
      </div>
    </div>
  );
}
