import React from "react";
import { realmText, realmBorder } from "../../data/realmStyles";

/**
 * The bordered small-caps button used across the header, modals, and the
 * resolution screen — formerly the `.icon-btn` CSS class. Dissolving it into a
 * component keeps the markup utility-first while giving the repeated tone /
 * size logic one home.
 *
 * - `danger` swaps the gold hover accent for rose-ember (the destructive set).
 * - `accent` paints the border + text in a realm colour (echo/neon/…). Like the
 *   old inline `style` realm buttons, an accent button has no hover recolour —
 *   its realm tint is the point.
 * - `size` covers the three paddings that were sprinkled inline.
 */
type Size = "sm" | "md" | "lg";

const PAD: Record<Size, string> = {
  sm: "px-[10px] py-1",
  md: "px-[14px] py-[6px]",
  lg: "px-[22px] py-[10px]",
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
  accent?: string | null;
  size?: Size;
  /** Selected state for toggle-group buttons (provider / intensity / etc.):
   *  the rose-gold-tinted fill that used to be an inline override. Replaces the
   *  default tone so the border/text/bg utilities never collide. */
  active?: boolean;
  /** Replaces the preset padding for the rare one-off (e.g. "px-5 py-[9px]");
   *  avoids ambiguous duplicate px-/py- utilities from a className override. */
  pad?: string;
}

const BASE =
  "bg-transparent border font-display text-[10px] tracking-[0.25em] cursor-pointer " +
  "transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed";

export function IconButton({
  danger = false,
  accent = null,
  size = "md",
  active = false,
  pad,
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  const tone = active
    ? "border-rose-gold/55 text-cream-bright bg-rose-gold/[0.08]"
    : accent
      ? `${realmText[accent] ?? "text-cream-dim"} ${realmBorder[accent] ?? "border-cream/20"}`
      : danger
        ? "border-cream/20 text-cream-dim enabled:hover:border-rose-ember/50 enabled:hover:text-rose-ember high-contrast:border-white/50"
        : "border-cream/20 text-cream-dim enabled:hover:border-rose-gold/50 enabled:hover:text-cream-bright high-contrast:border-white/50";
  return (
    <button className={`${BASE} ${pad ?? PAD[size]} ${tone} ${className}`} {...rest}>
      {children}
    </button>
  );
}
