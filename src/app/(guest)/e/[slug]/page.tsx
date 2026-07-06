import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { listChallenges } from "@/lib/db/challenges";
import { signOriginalUrl } from "@/lib/db/media";
import { DICT } from "@/lib/i18n";
import { resolveLangServer } from "@/lib/i18n/server";
import { GuestScatter } from "@/components/guest/scatter";
import { GuestExperience } from "./guest-experience";

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
  const primaryColor = readPrimaryColor(event.theme);
  const tableLabel = sp.table?.trim() || null;

  // Photo challenges (optional prompts the couple set up). Failure is
  // non-fatal — the upload card renders without the chips.
  let challenges: { id: string; prompt: string }[] = [];
  try {
    challenges = (await listChallenges(admin, event.id)).map((c) => ({
      id: c.id,
      prompt: c.prompt,
    }));
  } catch {
    // migrations not applied yet, or transient error — skip the chips
  }

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
      <GuestExperience
        initialLang={lang}
        eventSlug={event.slug}
        coupleNames={event.couple_names}
        welcomeMessage={event.welcome_message}
        coverUrl={coverUrl}
        primaryColor={primaryColor}
        tableLabel={tableLabel}
        maxPerGuest={event.max_uploads_per_guest}
        uploadEnabled={event.upload_enabled}
        challenges={challenges}
      />
    </main>
  );
}
