export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        twilight:      "var(--twilight)",
        "twilight-deep": "var(--twilight-deep)",
        gloaming:      "var(--gloaming)",
        cream: {
          DEFAULT:     "var(--cream)",
          bright:      "var(--cream-bright)",
          dim:         "var(--cream-dim)",
          faint:       "var(--cream-faint)",
        },
        "rose-gold":   "var(--rose-gold)",
        "rose-ember":  "var(--rose-ember)",
      },
      fontFamily: {
        display: ["Cinzel", "serif"],
        body:    ["Cormorant Garamond", "serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        display: "0.14em",
        wide:    "0.12em",
      },
    },
  },
  plugins: [],
};
