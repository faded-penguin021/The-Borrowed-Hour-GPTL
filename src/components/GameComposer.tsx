import React, { useState, useRef, useEffect } from "react";
import { useGameActions, useGameStory, useGameRun } from "../context/GameContext";
import { realmText } from "../data/realmStyles";
import { BORROWED_INPUT } from "./ui/styleClasses";
import { Sparkles, ChevronRight } from "lucide-react";

/**
 * The input row. Owns `input` and the per-session input history locally so a
 * keystroke only re-renders this component — never the narration log or any
 * other game-context consumer.
 *
 * Takes no props and reads only the stable action surface (`useGameActions`),
 * the low-churn story slice (`useGameStory`), and runtime `loading`
 * (`useGameRun`). None of those change identity on a streaming delta, so wrapped
 * in `React.memo` the composer no longer re-renders while narration streams —
 * the render thrash this split was made to kill.
 */
export const GameComposer = React.memo(function GameComposer() {
  const { submit, exitMetaMode } = useGameActions();
  const { premise, metaMode, ended } = useGameStory();
  const { loading } = useGameRun();
  const [input, setInput] = useState("");
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [inputHistoryIndex, setInputHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    const ok = await submit(text);
    if (ok === false) {
      setInput(text);
      requestAnimationFrame(autosize);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autosize();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    <div className="game-input-row relative px-6 py-5 border-t border-cream/10 bg-twilight-deep/80 backdrop-blur-[4px]">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 items-start">
          <span
            className={`font-display font-medium text-2xl leading-none mt-2 select-none ${metaMode && premise ? realmText[premise.realm] : "text-rose-ember"}`}
          >
            {metaMode ? <Sparkles size={20} strokeWidth={1.5} /> : <ChevronRight size={20} strokeWidth={1.5} />}
          </span>
          <textarea
            ref={textareaRef}
            data-testid="composer-input"
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={inputLocked}
            rows={1}
            autoFocus={!ended || metaMode}
            placeholder={ended && !metaMode ? "The chronicle is closed." : metaMode ? "Ask the author. Speak frankly." : loading ? "" : "Speak. Move. Search your pockets. Lie. Run. Ask a question."}
            className={`${BORROWED_INPUT} flex-1 px-4 py-3 resize-none text-lg disabled:opacity-50 min-h-[52px] max-h-[160px] leading-[1.5]`}
          />
        </div>
        <div className="text-xs mt-2 ml-8 italic font-body flex flex-wrap items-center gap-x-4 gap-y-1 text-cream-faint">
          <span>↵ {metaMode ? "ask" : "act"}</span>
          <span>⇧ ↵ new line</span>
          <span>click the page to skip the writing</span>
          {metaMode && (
            <button
              onClick={exitMetaMode}
              className="ml-auto bg-transparent border-0 cursor-pointer text-cream-dim italic font-body text-[12px] underline underline-offset-[3px]"
            >
              leave the author's table
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
