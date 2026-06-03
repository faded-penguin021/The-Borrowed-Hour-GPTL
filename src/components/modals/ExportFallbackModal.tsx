import React, { useRef, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { Copy, X } from "lucide-react";

interface ExportFallbackModalProps {
  text: string;
  onClose: () => void;
}

export function ExportFallbackModal({ text, onClose }: ExportFallbackModalProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      try {
        ref.current.select();
      } catch {}
    }
  }, []);
  return (
    <Modal onClose={onClose}>
        <div className="px-6 py-5 border-b border-cream/10 flex items-center justify-between">
          <div>
            <div className="font-display font-medium text-[10px] mb-1 text-cream-faint tracking-[0.4em]">
              <Copy size={12} strokeWidth={1.5} className="mr-1" />COPY THE CHRONICLE
            </div>
            <h2 className="font-display font-medium text-xl text-cream-bright tracking-[0.04em]">
              Long-press the text below, then choose Copy
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-display font-medium text-sm text-cream-dim tracking-[0.2em]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="font-body italic text-sm mb-3 text-cream-dim leading-[1.6]">
            Your browser would not place this on the clipboard directly. The chronicle is selected below — long-press (on phone) or use Ctrl/Cmd+C (on desktop) to copy it. Paste it wherever you wish.
          </p>
          <textarea
            ref={ref}
            readOnly
            value={text}
            className="w-full font-body text-sm min-h-[240px] max-h-[50vh] p-3 bg-black/30 border border-cream/15 rounded-[2px] text-cream-bright leading-[1.5] resize-y"
          />
        </div>
        <div className="px-6 py-4 border-t border-cream/10 flex justify-end">
          <IconButton onClick={onClose} pad="px-[18px] py-2">
            <X size={14} strokeWidth={1.5} aria-hidden="true" className="mr-1" />DONE
          </IconButton>
        </div>
    </Modal>
  );
}
