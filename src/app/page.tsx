import { resolveLangServer } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/lib/i18n/language-switch";

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

const COPY = {
  en: {
    title: "Wedding photo sharing",
    subtitle: "Scan a QR code at your table to share photos with the couple.",
  },
  "zh-Hant": {
    title: "婚禮相片分享",
    subtitle: "請掃描座位上的 QR code,將相片直接送給新人。",
  },
} as const;

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang = await resolveLangServer(sp.lang);
  const t = COPY[lang];

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center animate-[fadeup_500ms_ease-out]">
        <h1 className="font-serif text-4xl text-ink-900 mb-3">{t.title}</h1>
        <p className="text-ink-700">{t.subtitle}</p>
      </div>
      <div className="mt-10">
        <LanguageSwitch current={lang} basePath="/" />
      </div>
    </main>
  );
}
