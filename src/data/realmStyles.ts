// Realm accents are chosen at runtime from premise data, so the utility class
// names can't be inferred from the JSX. Keeping the full literal strings here
// lets Tailwind's JIT scanner discover them, and gives every component one
// place to read realm styling from instead of `style={{ color: ... }}`.
//
// Alphas match the former --<realm>-border / --<realm>-bg vars: echo borders at
// 0.40, the rest at 0.45; every realm tint background at 0.06.

export const realmText: Record<string, string> = {
  echo: "text-echo",
  neon: "text-neon",
  omen: "text-omen",
  dream: "text-dream",
  wild: "text-wild",
};

export const realmBorder: Record<string, string> = {
  echo: "border-echo/40",
  neon: "border-neon/45",
  omen: "border-omen/45",
  dream: "border-dream/45",
  wild: "border-wild/45",
};

export const realmPill: Record<string, string> = {
  echo: "text-echo border-echo/40 bg-echo/[0.06]",
  neon: "text-neon border-neon/45 bg-neon/[0.06]",
  omen: "text-omen border-omen/45 bg-omen/[0.06]",
  dream: "text-dream border-dream/45 bg-dream/[0.06]",
  wild: "text-wild border-wild/45 bg-wild/[0.06]",
};
