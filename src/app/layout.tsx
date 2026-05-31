import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Noto_Sans_TC } from "next/font/google";

import { resolveLangServer } from "@/lib/i18n/server";
import "./globals.css";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const cjk = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-cjk",
  display: "swap",
  weight: ["400", "500", "700"],
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
  themeColor: "#FBF8F3",
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
