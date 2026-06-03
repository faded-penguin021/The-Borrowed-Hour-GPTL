import React from "react";

/**
 * The blurred backdrop + gradient panel shared by every modal — formerly the
 * `.modal-backdrop` / `.modal-panel` CSS classes. The mobile compositor-blur
 * drop and the high-contrast overrides ride along as utilities so nothing
 * modal-specific has to live in the stylesheet.
 *
 * `panelClassName` is for the occasional per-modal tweak (e.g. a wider panel).
 */
interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  /** Spread onto the backdrop (role, aria-label, …) when a caller needs it. */
  backdropProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function Modal({ onClose, children, panelClassName = "", backdropProps }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-twilight-deep/85 backdrop-blur-[6px] animate-[fadeIn_0.3s_ease-out] max-[720px]:backdrop-blur-none max-[720px]:bg-twilight-deep/[0.94] high-contrast:bg-black/[0.92]"
      onClick={onClose}
      {...backdropProps}
    >
      <div
        className={`relative flex flex-col w-full max-w-[560px] max-h-[85vh] min-h-0 overflow-hidden border border-cream/15 bg-[linear-gradient(180deg,#16121f_0%,#0a0814_100%)] high-contrast:border-white/45 high-contrast:bg-[#050505] ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
