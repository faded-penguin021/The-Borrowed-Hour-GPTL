// @ts-check
import React, { useRef, useEffect } from "react";

/**
 * @param {Object} props
 * @param {string} props.text
 * @param {() => void} props.onClose
 */
export function ExportFallbackModal({ text, onClose }) {
  /** @type {React.RefObject<HTMLTextAreaElement>} */
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      try {
        ref.current.select();
      } catch {}
    }
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <div>
            <div
              className="display-font text-[10px] mb-1"
              style={{ color: "var(--cream-faint)", letterSpacing: "0.4em" }}
            >
              ❧ COPY THE CHRONICLE
            </div>
            <h2
              className="display-font text-xl"
              style={{ color: "var(--cream-bright)", letterSpacing: "0.04em" }}
            >
              Long-press the text below, then choose Copy
            </h2>
          </div>
          <button
            onClick={onClose}
            className="display-font text-sm"
            style={{ color: "var(--cream-dim)", letterSpacing: "0.2em" }}
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">
          <p
            className="body-font italic text-sm mb-3"
            style={{ color: "var(--cream-dim)", lineHeight: 1.6 }}
          >
            Your browser would not place this on the clipboard directly. The chronicle is selected below — long-press (on phone) or use Ctrl/Cmd+C (on desktop) to copy it. Paste it wherever you wish.
          </p>
          <textarea
            ref={ref}
            readOnly
            value={text}
            className="w-full body-font text-sm"
            style={{
              minHeight: "240px",
              maxHeight: "50vh",
              padding: "12px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(232, 222, 197, 0.15)",
              borderRadius: "2px",
              color: "var(--cream-bright)",
              lineHeight: 1.5,
              resize: "vertical"
            }}
          />
        </div>
        <div
          className="px-6 py-4 border-t flex justify-end"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <button onClick={onClose} className="icon-btn" style={{ padding: "8px 18px" }}>
            ✕ DONE
          </button>
        </div>
      </div>
    </div>
  );
}
