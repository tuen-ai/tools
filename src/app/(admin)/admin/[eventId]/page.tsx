import Link from "next/link";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById, getEventStats } from "@/lib/db/events";
import { listMediaPage, signThumbnailUrls } from "@/lib/db/media";
import { listMessagesPage } from "@/lib/db/messages";
import { listTables } from "@/lib/db/tables";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import {
  CameraIcon,
  GlassIcon,
  EnvelopeIcon,
  TableIcon,
  PlayIcon,
} from "@/components/ui/icons";
import { MediaGrid } from "./media-grid";
import { MessagesPanel } from "./messages-panel";

type StatIcon = typeof CameraIcon;

const PAGE_SIZE = 60;
const MESSAGE_LIMIT = 50;

interface Props {
  params: Promise<{ eventId: string }>;
}

export default async function EventDashboardPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const admin = createAdminClient();
  const [event, page, messages, tables, stats, lang] = await Promise.all([
    getEventById(admin, eventId),
    listMediaPage(admin, { eventId, offset: 0, limit: PAGE_SIZE }),
    listMessagesPage(admin, { eventId, offset: 0, limit: MESSAGE_LIMIT }),
    listTables(admin, eventId),
    getEventStats(admin, eventId),
    resolveLangServer(),
  ]);
  const t = ADMIN_DICT[lang];

  if (!event) {
    return <div className="text-ink-500">{t.eventNotFound}</div>;
  }

  const signed = await signThumbnailUrls(admin, page.rows);
  const thumbMap = new Map(signed.map((s) => [s.id, s.url]));

  const statItems: {
    label: string;
    value: number;
    Icon: StatIcon;
    tint: string;
  }[] = [
    { label: t.statPhotos, value: page.total, Icon: CameraIcon, tint: "bg-blush-500/12 text-blush-700" },
    { label: t.statGuests, value: stats.guests, Icon: GlassIcon, tint: "bg-peach-soft text-peach-deep" },
    { label: t.statMessages, value: stats.messages, Icon: EnvelopeIcon, tint: "bg-sage-500/25 text-sage-700" },
    { label: t.statTables, value: tables.length, Icon: TableIcon, tint: "bg-lav-soft text-lav-deep" },
  ];

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
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 text-white px-3 py-2 hover:bg-ink-700 transition"
            title={t.navSlideshowTitle}
          >
            <PlayIcon className="h-4 w-4" />
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statItems.map(({ label, value, Icon, tint }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-cream-200 px-4 py-3 flex items-center gap-3"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-xl text-ink-900 leading-tight">
                {value}
              </p>
              <p className="text-[11px] text-ink-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

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
        tables={tables.map((tb) => ({ id: tb.id, label: tb.label }))}
      />
    </div>
  );
}
