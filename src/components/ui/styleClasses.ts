// Utility-class recipes for the form controls that recur across settings rows
// and modals — formerly the .btn-settings / .field-settings / .borrowed-input
// CSS classes. Kept as shared constants so the long utility strings live in one
// place instead of being copied down every row.

export const BTN_SETTINGS =
  "px-3 py-[7px] text-[11px] rounded-md cursor-pointer whitespace-nowrap " +
  "border border-cream/[0.22] bg-[#161215]/90 text-cream-dim tracking-[0.14em] " +
  "disabled:cursor-default disabled:opacity-[0.45]";

export const FIELD_SETTINGS =
  "flex-1 px-2 py-[7px] text-xs rounded-md min-w-0 " +
  "border border-cream/[0.22] bg-[#161215]/90 text-cream-bright font-mono";

export const BORROWED_INPUT =
  "bg-twilight/65 border border-cream/15 text-cream-bright font-body " +
  "transition-[border-color,box-shadow] duration-300 " +
  "placeholder:text-cream-faint placeholder:italic focus:outline-none focus:border-rose-gold/45 " +
  "focus:shadow-[0_0_30px_rgba(212,165,116,0.08),inset_0_0_0_1px_rgba(212,165,116,0.1)]";
