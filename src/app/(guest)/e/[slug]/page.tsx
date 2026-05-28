import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { DICT, resolveLang } from "@/lib/i18n";
import { LanguageSwitch } from "@/lib/i18n/language-switch";
import { UploadClient } from "./upload-client";
import { ClosedScreen } from "./closed";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const [{ slug }, sp, hdrs] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);
  const event = await getEventBySlug(createAdminClient(), slug);
  if (!event) return { title: "Event not found" };

  const lang = resolveLang({
    searchParamLang: sp.lang,
    acceptLanguage: hdrs.get("accept-language"),
  });
  const t = DICT[lang];

  const title = `${event.couple_names} — ${t.eyebrow}`;
  const description =
    event.welcome_message ??
    (lang === "zh-Hant"
      ? `將您的相片直接分享給 ${event.couple_names}。`
      : `Send your photos straight to ${event.couple_names}.`);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: t.eyebrow,
    },
    twitter: { card: "summary", title, description },
    robots: { index: false, follow: false },
  };
}

function readPrimaryColor(theme: Record<string, unknown> | null): string | null {
  const v = theme?.["primaryColor"];
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

export default async function GuestEventPage({ params, searchParams }: Props) {
  const [{ slug }, sp, hdrs] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);
  const admin = createAdminClient();
  const event = await getEventBySlug(admin, slug);

  if (!event) notFound();

  const lang = resolveLang({
    searchParamLang: sp.lang,
    acceptLanguage: hdrs.get("accept-language"),
  });
  const t = DICT[lang];
  const primaryColor = readPrimaryColor(event.theme);

  return (
    <main className="min-h-dvh flex flex-col items-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <p
            className={`uppercase tracking-[0.25em] text-xs mb-3 ${
              primaryColor ? "" : "text-blush-600"
            }`}
            style={primaryColor ? { color: primaryColor } : undefined}
          >
            {t.eyebrow}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink-900 leading-tight">
            {event.couple_names}
          </h1>
          {event.welcome_message ? (
            <p className="mt-4 text-ink-700 text-[15px] leading-relaxed">
              {event.welcome_message}
            </p>
          ) : null}
        </header>

        {event.upload_enabled ? (
          <UploadClient
            lang={lang}
            eventSlug={event.slug}
            maxPerGuest={event.max_uploads_per_guest}
            primaryColor={primaryColor}
          />
        ) : (
          <ClosedScreen lang={lang} />
        )}

        <div className="mt-8">
          <LanguageSwitch current={lang} basePath={`/e/${event.slug}`} />
        </div>
      </div>
    </main>
  );
}
