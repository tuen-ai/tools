import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAdminEvents } from "@/lib/db/events";

export default async function AdminEventsPage() {
  const supabase = await createSupabaseServerClient();
  const events = await listAdminEvents(supabase);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink-900">Your events</h1>
        <Link
          href="/admin/new"
          className="rounded-xl bg-blush-500 px-4 py-2 text-white text-sm font-medium hover:bg-blush-600 transition"
        >
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState />
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
                  <StatusPill enabled={e.upload_enabled} />
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

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full ${
        enabled
          ? "bg-sage-500/15 text-sage-600"
          : "bg-ink-500/10 text-ink-500"
      }`}
    >
      {enabled ? "Open" : "Closed"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-3xl border border-cream-200 p-10 text-center">
      <div className="text-4xl mb-3" aria-hidden>
        💍
      </div>
      <h2 className="font-serif text-xl text-ink-900 mb-2">
        No events yet
      </h2>
      <p className="text-ink-500 text-sm mb-6">
        Create your first event to print a QR code and start collecting photos.
      </p>
      <Link
        href="/admin/new"
        className="inline-block rounded-xl bg-blush-500 px-5 py-3 text-white text-sm font-medium hover:bg-blush-600 transition"
      >
        Create event
      </Link>
    </div>
  );
}
