// Each palette colour is backed by a CSS variable holding space-separated RGB
// channels (defined in src/styles/theme.css). Wrapping them as
// `rgb(var(--x) / <alpha-value>)` is what lets Tailwind's opacity modifiers
// work — e.g. `border-cream/10` now resolves to the old hand-written
// `rgba(232, 222, 197, 0.1)`. The vars stay the runtime source of truth (the
// high-contrast theme just overrides them), while this config is the single
// place the palette is named.
const channel = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        twilight: {
          DEFAULT: channel("twilight"),
          deep: channel("twilight-deep"),
        },
        gloaming: channel("gloaming"),
        cream: {
          DEFAULT: channel("cream"),
          bright: channel("cream-bright"),
          dim: channel("cream-dim"),
          faint: channel("cream-faint"),
        },
        "rose-gold": channel("rose-gold"),
        "rose-ember": channel("rose-ember"),
        // Realm accents — selected at runtime from premise data, so the
        // utility names are kept literal in src/data/realmStyles.ts for the JIT
        // scanner to discover.
        echo: channel("echo"),
        neon: channel("neon"),
        omen: channel("omen"),
        dream: channel("dream"),
        wild: channel("wild"),
      },
      fontFamily: {
        display: ["Cinzel", "serif"],
        body: ["Cormorant Garamond", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        display: "0.14em",
        wide: "0.12em",
      },
    },
  },
  plugins: [
    // The opt-in high-contrast theme is toggled by a `.high-contrast` class on
    // the root shell. Most colours adapt for free because the CSS vars are
    // overridden (see theme.css), but a few borders need to be strengthened
    // past their normal ghost-strength alpha; this variant lets that stay in
    // the markup as `high-contrast:border-white/50` rather than a stray rule.
    ({ addVariant }) => {
      addVariant("high-contrast", ".borrowed-root.high-contrast &");
    },
  ],
};
