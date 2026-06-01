// @ts-check
import React, { useState } from "react";

/**
 * @param {Object} props
 * @param {string} [props.raw]
 */
export function ErrorRawDetail({ raw }) {
  const [copied, setCopied] = useState(false);
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const truncated = trimmed.length > 500;
  const preview = truncated
    ? trimmed.slice(0, 200) + "\n… (" + (trimmed.length - 400) + " chars elided) …\n" + trimmed.slice(-200)
    : trimmed;
  const handleCopy = (/** @type {React.MouseEvent<HTMLButtonElement>} */ e) => {
    e.stopPropagation();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(trimmed).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {});
    }
  };
  return (
    <div className="mt-2" style={{ textAlign: "left", opacity: 0.75 }}>
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "11px",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: "200px",
          overflowY: "auto",
          padding: "8px 10px",
          border: "1px solid rgba(217,122,122,0.35)",
          borderRadius: "4px",
          background: "rgba(0,0,0,0.18)"
        }}
      >
        {preview}
      </div>
      <button
        onClick={handleCopy}
        className="icon-btn"
        style={{
          marginTop: "6px",
          fontSize: "10px",
          letterSpacing: "0.18em",
          padding: "4px 10px"
        }}
        title="Copy the full raw model response to the clipboard"
      >
        {copied ? "COPIED" : "COPY RAW RESPONSE"}
      </button>
    </div>
  );
}
