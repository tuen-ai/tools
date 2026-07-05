import type { Metadata, Viewport } from "next";
import { Nunito_Sans, DM_Serif_Display, Noto_Serif_TC } from "next/font/google";

import { resolveLangServer } from "@/lib/i18n/server";
import "./globals.css";

// French-vintage type pairing (design E). Body: Nunito Sans — quiet
// humanist sans. Display: DM Serif Display (incl. italic) for headings /
// couple names. CJK falls back to Noto Serif TC so Chinese headings carry
// the same engraved feel.
const body = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "600", "700"],
});
const display = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});
const cjk = Noto_Serif_TC({
  subsets: ["latin"],
  variable: "--font-cjk",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "婚禮相片分享 · Wedding photo sharing",
  description:
    "將相片直接送給新人 · Share your photos with the couple",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F5EDDE",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await resolveLangServer();
  // Match the HTML lang attribute to the resolved language so screen readers
  // and CJK font fallbacks pick the right glyphs.
  const htmlLang = lang === "zh-Hant" ? "zh-Hant" : "en";

  return (
    <html
      lang={htmlLang}
      className={`${body.variable} ${display.variable} ${cjk.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
