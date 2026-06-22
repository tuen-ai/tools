import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Grown-up cute" candy palette. Semantic names are kept the same
        // as the original elegant theme so existing class usages shift
        // automatically:
        //   cream  → warm pink-cream surface
        //   blush  → strawberry primary
        //   sage   → mint (success / live)
        //   ink    → soft warm-plum text (never harsh black)
        cream: {
          50:  "#FFF6F2", // page background
          100: "#FFF0F4", // tinted inset (toggle track, pills)
          200: "#FFE3EA", // soft borders
        },
        blush: {
          400: "#FFB9C8",
          500: "#FF8FA3", // primary
          600: "#F06E89", // primary pressed / hover
        },
        sage: {
          500: "#A8E0C8",
          600: "#5FB592",
        },
        ink: {
          900: "#54434B", // headings (still AA on cream)
          700: "#6E5C64", // body
          500: "#9C8C92", // muted
        },
        // Accent candy tones for stat tiles, badges, decorative scatter.
        peach:  { soft: "#FFEBDD", DEFAULT: "#FFC9A8", deep: "#E8965E" },
        butter: { soft: "#FFF3D2", DEFAULT: "#FFE08A", deep: "#D6A52E" },
        lav:    { soft: "#ECE5FB", DEFAULT: "#CDBDF0", deep: "#8B6FC9" },
        sky:    { soft: "#E2F0FB", DEFAULT: "#AFD4F2", deep: "#5C9FD6" },
      },
      fontFamily: {
        // "serif" key = the rounded display face (Fredoka). Kept as the key
        // name so existing `font-serif` usages become the cute headline font.
        // CJK glyphs fall back to Noto Sans TC.
        serif: ["var(--font-display)", "var(--font-cjk)", "ui-rounded", "system-ui", "sans-serif"],
        sans:  ["var(--font-body)", "var(--font-cjk)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Rounder everything — the single biggest "cute" lever after color.
        xl:   "1rem",
        "2xl": "1.375rem",
        "3xl": "1.875rem",
      },
      boxShadow: {
        soft: "0 18px 40px -22px rgba(214, 120, 140, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
