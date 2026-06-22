import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAdminEvents } from "@/lib/db/events";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT, type AdminDict } from "@/lib/i18n/admin-dict";
import { RingsIcon } from "@/components/ui/icons";

export default async function AdminEventsPage() {
  const supabase = await createSupabaseServerClient();
  const [events, lang] = await Promise.all([
    listAdminEvents(supabase),
    resolveLangServer(),
  ]);
  const t = ADMIN_DICT[lang];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink-900">{t.yourEvents}</h1>
        <Link
          href="/admin/new"
          className="rounded-xl bg-blush-500 px-4 py-2 text-white text-sm font-medium hover:bg-blush-600 transition"
        >
          {t.newEventCta}
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/admin/${e.id}`}
                className="block rounded-2xl border border-cream-200 bg-white p-5 hover:border-blush-400 hover:shadow-soft transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-serif text-lg text-ink-900 truncate">
                    {e.couple_names}
                  </h2>
                  <StatusPill enabled={e.upload_enabled} t={t} />
                </div>
                <p className="text-sm text-ink-500 truncate">/e/{e.slug}</p>
                {e.event_date ? (
                  <p className="text-xs text-ink-500 mt-2">{e.event_date}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ enabled, t }: { enabled: boolean; t: AdminDict }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full ${
        enabled
          ? "bg-sage-500/15 text-sage-600"
          : "bg-ink-500/10 text-ink-500"
      }`}
    >
      {enabled ? t.statusOpen : t.statusClosed}
    </span>
  );
}

function EmptyState({ t }: { t: AdminDict }) {
  return (
    <div className="bg-white rounded-3xl border border-cream-200 p-10 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blush-400/15 text-blush-600">
        <RingsIcon className="h-7 w-7" />
      </div>
      <h2 className="font-serif text-xl text-ink-900 mb-2">
        {t.eventsEmptyTitle}
      </h2>
      <p className="text-ink-500 text-sm mb-6">{t.eventsEmptyBody}</p>
      <Link
        href="/admin/new"
        className="inline-block rounded-xl bg-blush-500 px-5 py-3 text-white text-sm font-medium hover:bg-blush-600 transition"
      >
        {t.eventsEmptyCta}
      </Link>
    </div>
  );
}
