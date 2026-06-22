import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { signOriginalUrl } from "@/lib/db/media";
import { DICT } from "@/lib/i18n";
import { resolveLangServer } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/lib/i18n/language-switch";
import { GuestScatter } from "@/components/guest/scatter";
import { UploadClient } from "./upload-client";
import { ClosedScreen } from "./closed";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; table?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const event = await getEventBySlug(createAdminClient(), slug);
  if (!event) return { title: "Event not found" };

  const lang = await resolveLangServer(sp.lang);
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
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const admin = createAdminClient();
  const event = await getEventBySlug(admin, slug);

  if (!event) notFound();

  const lang = await resolveLangServer(sp.lang);
  const t = DICT[lang];
  const primaryColor = readPrimaryColor(event.theme);
  const tableLabel = sp.table?.trim() || null;

  // Sign a short-lived URL for the cover image (bucket is private).
  // Use a 30-minute TTL — the guest page is cached for 60s anyway, so
  // the URL outlives the cache by a comfortable margin.
  let coverUrl: string | null = null;
  if (event.cover_image_path) {
    try {
      coverUrl = await signOriginalUrl(admin, event.cover_image_path, 1800);
    } catch {
      // Missing cover is non-fatal — render without it.
    }
  }

  return (
    <main className="relative min-h-dvh flex flex-col items-center px-5 py-8 sm:py-12 overflow-hidden">
      <GuestScatter />
      <div className="relative z-10 w-full max-w-md animate-[fadeup_500ms_ease-out]">
        {coverUrl ? (
          <div className="mb-6 overflow-hidden rounded-3xl shadow-soft animate-[fadeup_700ms_ease-out]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              className="w-full h-56 object-cover"
            />
          </div>
        ) : null}

        <header className="text-center mb-8">
          {tableLabel ? (
            <p
              className={`inline-block text-[11px] font-medium px-3 py-1 rounded-full mb-3 ${
                primaryColor ? "text-white" : "bg-blush-500/10 text-blush-600"
              }`}
              style={primaryColor ? { backgroundColor: primaryColor } : undefined}
            >
              {t.tableBadge(tableLabel)}
            </p>
          ) : null}
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
            tableLabel={tableLabel}
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
