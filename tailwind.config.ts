import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  "#FBF8F3",
          100: "#F5EFE6",
          200: "#EADFD0",
        },
        blush: {
          400: "#E8B4B8",
          500: "#D9989E",
          600: "#C77B82",
        },
        sage: {
          500: "#8AA088",
          600: "#6E8A6C",
        },
        ink: {
          900: "#2A2622",
          700: "#5C5651",
          500: "#857F79",
        },
      },
      fontFamily: {
        // CJK font listed alongside Inter so Chinese glyphs render natively
        // without a flash of fallback. Order matters: Inter covers Latin
        // first, Noto Sans TC handles CJK ranges.
        serif: ["var(--font-display)", "var(--font-cjk)", "Georgia", "serif"],
        sans:  ["var(--font-body)", "var(--font-cjk)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(42, 38, 34, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
