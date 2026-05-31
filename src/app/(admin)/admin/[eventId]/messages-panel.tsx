"use client";

import { useEffect, useState, useTransition } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ADMIN_DICT, type AdminDict } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import { deleteMessageAction } from "./message-actions";

interface MessageRow {
  id: string;
  body: string;
  created_at: string;
  guest_id: string | null;
  guests: { display_name: string | null } | null;
}

interface Props {
  lang: Lang;
  eventId: string;
  initialRows: MessageRow[];
}

const FRESH_HIGHLIGHT_MS = 4000;

export function MessagesPanel({ lang, eventId, initialRows }: Props) {
  const t = ADMIN_DICT[lang];
  const [rows, setRows] = useState<MessageRow[]>(initialRows);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`event:${eventId}:messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as Omit<MessageRow, "guests">;
          // Realtime payload doesn't include the joined guests row;
          // we don't have a cheap way to resolve it here without
          // another round-trip. Show "Guest" placeholder for now.
          const next: MessageRow = { ...row, guests: null };
          setRows((prev) =>
            prev.some((r) => r.id === next.id) ? prev : [next, ...prev],
          );
          setFreshIds((prev) => new Set(prev).add(next.id));
          window.setTimeout(() => {
            setFreshIds((prev) => {
              const n = new Set(prev);
              n.delete(next.id);
              return n;
            });
          }, FRESH_HIGHLIGHT_MS);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setRows((prev) => prev.filter((r) => r.id !== id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (rows.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl border border-cream-200 p-5 space-y-3">
      <h2 className="font-serif text-lg text-ink-900">
        {t.messagesHeading(rows.length)}
      </h2>
      <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {rows.map((m) => (
          <MessageItem
            key={m.id}
            t={t}
            eventId={eventId}
            row={m}
            isFresh={freshIds.has(m.id)}
            onRemoved={() =>
              setRows((prev) => prev.filter((r) => r.id !== m.id))
            }
          />
        ))}
      </ul>
    </section>
  );
}

function MessageItem({
  t,
  eventId,
  row,
  isFresh,
  onRemoved,
}: {
  t: AdminDict;
  eventId: string;
  row: MessageRow;
  isFresh: boolean;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const name = row.guests?.display_name?.trim() || null;
  const when = new Date(row.created_at).toLocaleString();

  function remove() {
    startTransition(async () => {
      const res = await deleteMessageAction({ eventId, messageId: row.id });
      if (res.ok) onRemoved();
    });
  }

  return (
    <li
      className={`group rounded-xl border bg-cream-50 px-4 py-3 transition ${
        isFresh ? "border-blush-500 ring-2 ring-blush-500/30" : "border-cream-200"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-900 truncate">
          {name ?? <span className="text-ink-500 italic">{t.guestPlaceholder}</span>}
        </span>
        <span className="text-[11px] text-ink-500 shrink-0">{when}</span>
      </div>
      <p className="mt-1 text-sm text-ink-700 whitespace-pre-wrap break-words">
        {row.body}
      </p>
      <div className="mt-1 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-[11px] text-blush-600 hover:text-blush-500 disabled:opacity-60"
        >
          {pending ? t.removeMessagePending : t.removeMessage}
        </button>
      </div>
    </li>
  );
}
