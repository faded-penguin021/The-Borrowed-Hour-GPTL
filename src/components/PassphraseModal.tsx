import React, { useState, useEffect, useRef } from "react";
import { usePassphrase } from "../context/PassphraseContext";
import { Modal } from "./ui/Modal";
import { IconButton } from "./ui/IconButton";
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
    <Modal onClose={cancel} panelClassName="!max-w-[420px]">
        <div className="px-6 py-5 border-b border-cream/10">
          <div className="font-display font-medium text-[10px] mb-1 text-cream-faint tracking-[0.4em]">
            <Lock size={12} strokeWidth={1.5} className="mr-1" />PASSPHRASE
          </div>
          <h2 className="font-display font-medium text-base text-cream-bright tracking-[0.04em]">
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
            className="w-full font-body text-sm px-3 py-2.5 bg-black/30 border border-cream/15 rounded-md text-cream-bright"
          />
        </div>
        <div className="px-6 py-4 border-t border-cream/10 flex justify-end gap-3">
          <IconButton onClick={cancel} pad="px-[18px] py-2">
            CANCEL
          </IconButton>
          <IconButton
            onClick={submit}
            pad="px-[18px] py-2"
            disabled={!value.trim()}
          >
            UNLOCK
          </IconButton>
        </div>
    </Modal>
  );
}
