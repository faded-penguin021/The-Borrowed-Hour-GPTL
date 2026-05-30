// @ts-check
import React, { useState, useRef, useEffect } from "react";

/**
 * The input row. Owns `input` and the per-session input history locally so a
 * keystroke only re-renders this component — never the narration log or any
 * other game-context consumer.
 *
 * @param {Object} props
 * @param {(text: string) => (boolean | Promise<boolean>)} props.onSubmit
 * @param {Premise} props.premise
 * @param {boolean} props.metaMode
 * @param {string | null} props.ended
 * @param {boolean} props.loading
 * @param {() => void} props.onExitMeta
 */
export function GameComposer({ onSubmit, premise, metaMode, ended, loading, onExitMeta }) {
  const [input, setInput] = useState("");
  const [inputHistory, setInputHistory] = useState(/** @type {string[]} */ ([]));
  const [inputHistoryIndex, setInputHistoryIndex] = useState(-1);
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));

  const inputLocked = ended && !metaMode || loading;

  // Focus the field when we step into (or out of) the author's table.
  useEffect(() => {
    if (metaMode && textareaRef.current) textareaRef.current.focus();
  }, [metaMode]);

  const autosize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  const doSubmit = async () => {
    const text = input.trim();
    if (!text || inputLocked) return;
    setInput("");
    setInputHistory((h) => h[h.length - 1] === text ? h : [...h, text]);
    setInputHistoryIndex(-1);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const ok = await onSubmit(text);
    if (ok === false) {
      setInput(text);
      requestAnimationFrame(autosize);
    }
  };

  const onInputChange = (e) => {
    setInput(e.target.value);
    autosize();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSubmit();
      return;
    }
    const ta = textareaRef.current;
    if (!ta || inputHistory.length === 0) return;
    if (e.key === "ArrowUp" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      e.preventDefault();
      const newIndex = inputHistoryIndex === -1 ? inputHistory.length - 1 : Math.max(0, inputHistoryIndex - 1);
      setInputHistoryIndex(newIndex);
      setInput(inputHistory[newIndex]);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const v = textareaRef.current.value;
          textareaRef.current.setSelectionRange(v.length, v.length);
          autosize();
        }
      });
      return;
    }
    if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length && inputHistoryIndex !== -1) {
      e.preventDefault();
      const newIndex = inputHistoryIndex + 1;
      if (newIndex >= inputHistory.length) {
        setInputHistoryIndex(-1);
        setInput("");
      } else {
        setInputHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
      }
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const v = textareaRef.current.value;
          textareaRef.current.setSelectionRange(v.length, v.length);
          autosize();
        }
      });
    }
  };

  return (
    <div
      className="game-input-row relative px-6 py-5 border-t"
      style={{
        borderColor: "rgba(232, 222, 197, 0.1)",
        background: "rgba(5, 3, 9, 0.8)",
        backdropFilter: "blur(4px)"
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 items-start">
          <span
            className="display-font text-2xl leading-none mt-2 select-none"
            style={{ color: metaMode ? `var(--${premise.realm})` : "var(--rose-ember)" }}
          >
            {metaMode ? "✦" : "›"}
          </span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={inputLocked}
            rows={1}
            autoFocus={!ended || metaMode}
            placeholder={ended && !metaMode ? "The chronicle is closed." : metaMode ? "Ask the author. Speak frankly." : loading ? "" : "Speak. Move. Search your pockets. Lie. Run. Ask a question."}
            className="borrowed-input flex-1 px-4 py-3 resize-none text-lg disabled:opacity-50"
            style={{
              minHeight: "52px",
              maxHeight: "160px",
              fontFamily: "'Cormorant Garamond', serif",
              lineHeight: 1.5
            }}
          />
        </div>
        <div
          className="text-xs mt-2 ml-8 italic body-font flex flex-wrap items-center gap-x-4 gap-y-1"
          style={{ color: "var(--cream-faint)" }}
        >
          <span>↵ {metaMode ? "ask" : "act"}</span>
          <span>⇧ ↵ new line</span>
          <span>click the page to skip the writing</span>
          {metaMode && (
            <button
              onClick={onExitMeta}
              className="ml-auto"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--cream-dim)",
                fontStyle: "italic",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "12px",
                textDecoration: "underline",
                textUnderlineOffset: "3px"
              }}
            >
              leave the author's table
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
