import React, { useState, useRef, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { BORROWED_INPUT } from "../ui/styleClasses";
import { X, Sparkles } from "lucide-react";

interface CustomModalProps {
  onClose: () => void;
  onBegin: (text: string) => void;
  disabled: boolean;
}

export function CustomModal({ onClose, onBegin, disabled }: CustomModalProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
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
    <Modal onClose={onClose}>
        <div className="px-6 py-5 border-b border-cream/10 flex items-center justify-between">
          <div>
            <div className="font-display font-medium text-[10px] mb-1 text-wild tracking-[0.4em]">
              <Sparkles size={12} strokeWidth={1.5} className="mr-1" />THE UNWRITTEN HOUR
            </div>
            <h2 className="font-display font-medium text-xl text-cream-bright tracking-[0.04em]">
              Describe your scenario
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-display font-medium text-sm text-cream-dim tracking-[0.2em]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          <p className="font-body italic text-sm text-cream-dim leading-[1.6]">
            Describe enough to set the hour. Tell us where you are, what is happening, what is at stake — and most of all,{" "}
            <span className="text-cream-bright">who you are</span>
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
            className={`${BORROWED_INPUT} w-full px-4 py-3 resize-y text-base min-h-[180px] max-h-[320px] leading-[1.55] !border-wild/25`}
          />
          <div className="text-xs italic font-body flex items-center justify-between text-cream-faint">
            <span>
              {tooShort ? "A little more, please — at least 30 characters." : `${text.trim().length} characters · ⌘/Ctrl + ↵ to begin`}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-cream/10 flex items-center justify-end gap-3">
          <IconButton onClick={onClose} pad="px-[18px] py-2">
            CANCEL
          </IconButton>
          <IconButton
            onClick={handleBegin}
            disabled={tooShort || disabled}
            accent="wild"
            pad="px-[22px] py-2"
          >
            <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1.5" />BEGIN THIS HOUR
          </IconButton>
        </div>
    </Modal>
  );
}
