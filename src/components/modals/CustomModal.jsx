// @ts-check
import React, { useState, useRef, useEffect } from "react";

/**
 * @param {Object} props
 * @param {() => void} props.onClose
 * @param {(text: string) => void} props.onBegin
 * @param {boolean} props.disabled
 */
export function CustomModal({ onClose, onBegin, disabled }) {
  const [text, setText] = useState("");
  /** @type {React.RefObject<HTMLTextAreaElement>} */
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current)
      ref.current.focus();
  }, []);
  const tooShort = text.trim().length < 30;
  const handleBegin = () => {
    if (tooShort || disabled)
      return;
    onBegin(text.trim());
  };
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
              style={{ color: "var(--wild)", letterSpacing: "0.4em" }}
            >
              ✷ THE UNWRITTEN HOUR
            </div>
            <h2
              className="display-font text-xl"
              style={{ color: "var(--cream-bright)", letterSpacing: "0.04em" }}
            >
              Describe your scenario
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
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          <p
            className="body-font italic text-sm"
            style={{ color: "var(--cream-dim)", lineHeight: 1.6 }}
          >
            Describe enough to set the hour. Tell us where you are, what is happening, what is at stake — and most of all,{" "}
            <span style={{ color: "var(--cream-bright)" }}>who you are</span>
            : a name, a calling, a fear or appetite, a small particular truth that gives the hour a soul to pour through. A paragraph is plenty; even rich sentences will do.
          </p>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleBegin();
              }
            }}
            placeholder="Example: A lighthouse keeper on a remote island during a long winter. Three nights ago a ship was wrecked on the rocks below — but the bodies on the beach are not from any crew you know, and they are wearing uniforms from a war that ended a hundred years ago. Tonight, something is climbing the spiral stair."
            className="borrowed-input w-full px-4 py-3 resize-y text-base"
            style={{
              minHeight: "180px",
              maxHeight: "320px",
              fontFamily: "'Cormorant Garamond', serif",
              lineHeight: 1.55,
              borderColor: "rgba(184, 200, 150, 0.25)"
            }}
          />
          <div
            className="text-xs italic body-font flex items-center justify-between"
            style={{ color: "var(--cream-faint)" }}
          >
            <span>
              {tooShort ? "A little more, please — at least 30 characters." : `${text.trim().length} characters · ⌘/Ctrl + ↵ to begin`}
            </span>
          </div>
        </div>
        <div
          className="px-6 py-4 border-t flex items-center justify-end gap-3"
          style={{ borderColor: "rgba(232, 222, 197, 0.1)" }}
        >
          <button onClick={onClose} className="icon-btn" style={{ padding: "8px 18px" }}>
            CANCEL
          </button>
          <button
            onClick={handleBegin}
            disabled={tooShort || disabled}
            className="icon-btn"
            style={{
              padding: "8px 22px",
              borderColor: "var(--wild-border)",
              color: "var(--wild)"
            }}
          >
            ✷ BEGIN THIS HOUR
          </button>
        </div>
      </div>
    </div>
  );
}
