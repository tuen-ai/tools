import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { signThumbnailUrls, type SignedThumb } from "@/lib/db/media";
import { STORAGE_BUCKET, isVideoMime } from "@/lib/upload/constants";
import { resolveLangServer } from "@/lib/i18n/server";
import { SlideshowClient, type Slide } from "./slideshow-client";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Slideshow",
  robots: { index: false, follow: false },
};

export default async function SlideshowPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const lang = await resolveLangServer(sp.lang);
  const admin = createAdminClient();
  const event = await getEventBySlug(admin, slug);
  if (!event) notFound();

  // Seed the first 60 slides server-side so the projector lights up
  // instantly; the client polls for more after.
  const { data: media } = await admin
    .from("media")
    .select("id, storage_path, mime_type, created_at")
    .eq("event_id", event.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(60);

  const images = (media ?? []).filter((m) => !isVideoMime(m.mime_type));
  const videos = (media ?? []).filter((m) => isVideoMime(m.mime_type));

  const [imageSigned, videoSigned]: [SignedThumb[], Array<{ id: string; url: string } | null>] =
    await Promise.all([
      signThumbnailUrls(admin, images, {
        width: 1600,
        height: 1600,
        quality: 80,
        expiresInSec: 1800,
      }),
      Promise.all(
        videos.map(async (m) => {
          const { data, error } = await admin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(m.storage_path, 1800);
          if (error || !data) return null;
          return { id: m.id, url: data.signedUrl };
        }),
      ),
    ]);

  const urlById = new Map<string, string>();
  for (const s of imageSigned) urlById.set(s.id, s.url);
  for (const s of videoSigned) if (s) urlById.set(s.id, s.url);

  const initialSlides: Slide[] = (media ?? [])
    .map((m) => {
      const url = urlById.get(m.id);
      if (!url) return null;
      return {
        id: m.id,
        url,
        kind: isVideoMime(m.mime_type) ? ("video" as const) : ("image" as const),
        createdAt: m.created_at,
      };
    })
    .filter((s): s is Slide => s !== null);

  return (
    <SlideshowClient
      lang={lang}
      eventSlug={event.slug}
      coupleNames={event.couple_names}
      initialSlides={initialSlides}
    />
  );
}
