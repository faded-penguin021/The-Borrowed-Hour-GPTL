import React, { useState } from "react";
import { IconButton } from "./ui/IconButton";

interface ErrorRawDetailProps {
  raw?: unknown;
}

export function ErrorRawDetail({ raw }: ErrorRawDetailProps) {
  const [copied, setCopied] = useState(false);
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const truncated = trimmed.length > 500;
  const preview = truncated
    ? trimmed.slice(0, 200) + "\n… (" + (trimmed.length - 400) + " chars elided) …\n" + trimmed.slice(-200)
    : trimmed;
  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(trimmed).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {});
    }
  };
  return (
    <div className="mt-2 text-left opacity-[0.75]">
      <div className="font-mono text-[11px] leading-[1.4] whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto py-2 px-2.5 border border-[rgba(217,122,122,0.35)] rounded-[4px] bg-black/[0.18]">
        {preview}
      </div>
      <IconButton
        onClick={handleCopy}
        pad="px-[10px] py-1"
        className="mt-1.5 text-[10px] tracking-[0.18em]"
        title="Copy the full raw model response to the clipboard"
      >
        {copied ? "COPIED" : "COPY RAW RESPONSE"}
      </IconButton>
    </div>
  );
}
