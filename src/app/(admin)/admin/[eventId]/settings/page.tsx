import Link from "next/link";
import { notFound } from "next/navigation";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { signOriginalUrl } from "@/lib/db/media";
import { SettingsForm } from "./form";
import { CleanupPanel } from "./cleanup-panel";
import { CoverPanel } from "./cover-panel";

interface Props {
  params: Promise<{ eventId: string }>;
}

export default async function EventSettingsPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const admin = createAdminClient();
  const event = await getEventById(admin, eventId);
  if (!event) notFound();

  let coverUrl: string | null = null;
  if (event.cover_image_path) {
    try {
      coverUrl = await signOriginalUrl(admin, event.cover_image_path, 1800);
    } catch {
      // Stale path — admin will need to re-upload.
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href={`/admin/${eventId}`}
        className="inline-block text-sm text-ink-500 hover:text-ink-900 mb-4"
      >
        ← Back to photos
      </Link>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">
          The URL slug can’t be changed once an event has been created.
        </p>
      </header>
      <SettingsForm event={event} />
      <CoverPanel eventId={event.id} coverUrl={coverUrl} />
      <CleanupPanel eventId={event.id} />
    </div>
  );
}
