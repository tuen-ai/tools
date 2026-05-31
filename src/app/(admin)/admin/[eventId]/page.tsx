import Link from "next/link";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { listMediaPage, signThumbnailUrls } from "@/lib/db/media";
import { listMessagesPage } from "@/lib/db/messages";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { MediaGrid } from "./media-grid";
import { MessagesPanel } from "./messages-panel";

const PAGE_SIZE = 60;
const MESSAGE_LIMIT = 50;

interface Props {
  params: Promise<{ eventId: string }>;
}

export default async function EventDashboardPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const admin = createAdminClient();
  const [event, page, messages, lang] = await Promise.all([
    getEventById(admin, eventId),
    listMediaPage(admin, { eventId, offset: 0, limit: PAGE_SIZE }),
    listMessagesPage(admin, { eventId, offset: 0, limit: MESSAGE_LIMIT }),
    resolveLangServer(),
  ]);
  const t = ADMIN_DICT[lang];

  if (!event) {
    return <div className="text-ink-500">{t.eventNotFound}</div>;
  }

  const signed = await signThumbnailUrls(admin, page.rows);
  const thumbMap = new Map(signed.map((s) => [s.id, s.url]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500 mb-1">
            {event.upload_enabled ? t.uploadsOpen : t.uploadsClosed} · /e/
            {event.slug}
          </p>
          <h1 className="font-serif text-2xl text-ink-900">
            {event.couple_names}
          </h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/e/${event.slug}/show`}
            target="_blank"
            className="rounded-lg bg-ink-900 text-white px-3 py-2 hover:bg-ink-700 transition"
            title={t.navSlideshowTitle}
          >
            {t.navSlideshow}
          </Link>
          <a
            href={`/api/admin/events/${eventId}/export`}
            className="rounded-lg border border-cream-200 bg-white px-3 py-2 hover:border-blush-400 transition"
            title={t.navDownloadAllTitle}
          >
            {t.navDownloadAll}
          </a>
          <Link
            href={`/admin/${eventId}/qr`}
            className="rounded-lg border border-cream-200 bg-white px-3 py-2 hover:border-blush-400 transition"
          >
            {t.navQr}
          </Link>
          <Link
            href={`/admin/${eventId}/poster`}
            className="rounded-lg border border-cream-200 bg-white px-3 py-2 hover:border-blush-400 transition"
          >
            {t.navPoster}
          </Link>
          <Link
            href={`/admin/${eventId}/tables`}
            className="rounded-lg border border-cream-200 bg-white px-3 py-2 hover:border-blush-400 transition"
          >
            {t.navTables}
          </Link>
          <Link
            href={`/admin/${eventId}/settings`}
            className="rounded-lg border border-cream-200 bg-white px-3 py-2 hover:border-blush-400 transition"
          >
            {t.navSettings}
          </Link>
        </nav>
      </header>

      <MessagesPanel
        lang={lang}
        eventId={eventId}
        initialRows={messages.rows}
        initialAudioUrls={messages.audioUrls}
      />

      <MediaGrid
        lang={lang}
        eventId={eventId}
        initialRows={page.rows}
        initialThumbs={Object.fromEntries(thumbMap)}
        total={page.total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
