import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "French vintage" palette (design E). Semantic key names are kept
        // from the previous themes so existing class usages shift
        // automatically:
        //   cream  → aged-paper surface
        //   blush  → burgundy primary (was strawberry)
        //   sage   → vintage teal (success / live)
        //   ink    → warm sepia text
        // All text-on-light tokens verified ≥4.5:1 (AA) on their intended
        // backgrounds; white passes on blush-500 (9.0:1) and sage-600 (5.8:1).
        cream: {
          25:  "#FBF6EA", // card surface (lighter than the page, warm)
          50:  "#F5EDDE", // page background (aged paper)
          100: "#EFE4CD", // tinted inset (toggle track, pills)
          200: "#DECBA8", // soft borders
        },
        blush: {
          400: "#C98A8A", // soft accent / light-on-dark eyebrow (4.5:1 on ink-900)
          500: "#7C3030", // burgundy primary fill — white text passes AA
          600: "#5E2222", // pressed / bottom edge
          700: "#7C3030", // text-on-light (7.8:1 on paper) — same as the fill
        },
        sage: {
          500: "#7FA79A", // teal fill / status dot (decorative)
          600: "#3E6E64", // teal — white text passes AA (5.8:1)
          700: "#2E564E", // AA-safe success text on light (7.1:1)
        },
        ink: {
          900: "#3B3129", // headings (10.9:1 on paper)
          700: "#5E5245", // body / help text (6.5:1 on paper, 4.8:1 on cream-200)
          500: "#8A7D6C", // decorative only — not for informational text
        },
        // Vintage accent tones for stat tiles, badges, decorative scatter.
        peach:  { soft: "#F3E2D3", DEFAULT: "#C97F5C", deep: "#8F4E2E" }, // terracotta
        butter: { soft: "#F3E7C8", DEFAULT: "#D9A441", deep: "#7A5A14" }, // mustard
        lav:    { soft: "#E9E0E8", DEFAULT: "#B79AB4", deep: "#6E4A6A" }, // dusty plum
        sky:    { soft: "#DFE7E9", DEFAULT: "#93B3BA", deep: "#3F6570" }, // slate teal
      },
      fontFamily: {
        // "serif" key = the display face (DM Serif Display). Kept as the key
        // name so existing `font-serif` usages become the vintage headline
        // font. CJK glyphs fall back to Noto Serif TC for the same feel.
        serif: ["var(--font-display)", "var(--font-cjk)", "Georgia", "serif"],
        sans:  ["var(--font-body)", "var(--font-cjk)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Crisp, print-like corners — the vintage counterpart of the old
        // "rounder everything" cute lever.
        xl:   "0.375rem",
        "2xl": "0.5rem",
        "3xl": "0.625rem",
      },
      boxShadow: {
        soft: "0 16px 36px -24px rgba(90, 60, 30, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
