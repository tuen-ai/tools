import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { UploadClient } from "./upload-client";
import { ClosedScreen } from "./closed";

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(createAdminClient(), slug);
  if (!event) return { title: "Event not found" };

  const title = `${event.couple_names} — Share your photos`;
  const description =
    event.welcome_message ??
    `Send your photos straight to ${event.couple_names}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Wedding photo sharing",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: { index: false, follow: false }, // event pages are private
  };
}

export default async function GuestEventPage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const event = await getEventBySlug(admin, slug);

  if (!event) notFound();

  return (
    <main className="min-h-dvh flex flex-col items-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <p className="uppercase tracking-[0.25em] text-xs text-blush-600 mb-3">
            Wedding photo sharing
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
            eventSlug={event.slug}
            maxPerGuest={event.max_uploads_per_guest}
          />
        ) : (
          <ClosedScreen />
        )}
      </div>
    </main>
  );
}
