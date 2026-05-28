"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { Database, MediaStatus } from "@/types/database";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { setMediaStatusAction } from "./actions";

type MediaRow = Database["public"]["Tables"]["media"]["Row"];

interface Props {
  eventId: string;
  initialRows: MediaRow[];
  initialThumbs: Record<string, string>;
  total: number;
  pageSize: number;
}

interface MorePageResponse {
  rows: MediaRow[];
  thumbs: Record<string, string>;
  total: number;
}

const FRESH_HIGHLIGHT_MS = 4000;

export function MediaGrid({
  eventId,
  initialRows,
  initialThumbs,
  total: initialTotal,
  pageSize,
}: Props) {
  const [rows, setRows] = useState<MediaRow[]>(initialRows);
  const [thumbs, setThumbs] = useState<Record<string, string>>(initialThumbs);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("connecting");

  // Refs let the realtime callbacks read current state without re-subscribing
  // every render.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`event:${eventId}:media`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "media",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as MediaRow;
          if (rowsRef.current.some((r) => r.id === row.id)) return;

          // Fetch the thumb URL — bucket is private, can't sign client-side.
          let url: string | undefined;
          try {
            const res = await fetch(`/api/admin/media/${row.id}/thumb`);
            if (res.ok) url = (await res.json()).url as string;
          } catch {
            // Tile will render without a thumb if the request fails; the
            // user can refresh to retry.
          }

          setRows((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev],
          );
          setTotal((prev) => prev + 1);
          if (url) setThumbs((prev) => ({ ...prev, [row.id]: url! }));
          setFreshIds((prev) => new Set(prev).add(row.id));
          window.setTimeout(() => {
            setFreshIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
          }, FRESH_HIGHLIGHT_MS);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "media",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as MediaRow;
          setRows((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r)),
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setLiveStatus("offline");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const visibleRows = rows.filter((r) => r.status !== "deleted");
  const hasMore = visibleRows.length < total;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/media?offset=${rows.length}&limit=${pageSize}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MorePageResponse;
      setRows((prev) => [...prev, ...data.rows]);
      setThumbs((prev) => ({ ...prev, ...data.thumbs }));
      setTotal(data.total);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <LiveBadge status={liveStatus} count={total} />

      {visibleRows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-cream-200 p-10 text-center">
          <div className="text-4xl mb-3" aria-hidden>
            📷
          </div>
          <p className="text-ink-500 text-sm">
            No photos yet. Share the QR code with your guests to start.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visibleRows.map((row) => (
            <MediaTile
              key={row.id}
              row={row}
              thumb={thumbs[row.id]}
              isFresh={freshIds.has(row.id)}
              isActive={activeId === row.id}
              onOpen={() => setActiveId(row.id)}
              onClose={() => setActiveId(null)}
              onStatusChanged={(status) =>
                setRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, status } : r)),
                )
              }
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-xl border border-cream-200 bg-white px-5 py-2.5 text-sm hover:border-blush-400 disabled:opacity-60 transition"
          >
            {loadingMore
              ? "Loading…"
              : `Load more (${total - visibleRows.length} left)`}
          </button>
        </div>
      ) : null}
    </>
  );
}

function LiveBadge({
  status,
  count,
}: {
  status: "connecting" | "live" | "offline";
  count: number;
}) {
  const dot =
    status === "live"
      ? "bg-sage-500"
      : status === "offline"
        ? "bg-blush-600"
        : "bg-ink-500/50";
  const label =
    status === "live"
      ? "Live"
      : status === "offline"
        ? "Disconnected"
        : "Connecting…";

  return (
    <div className="flex items-center justify-between text-sm text-ink-500">
      <span>
        {count} photo{count === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
    </div>
  );
}

function MediaTile({
  row,
  thumb,
  isFresh,
  isActive,
  onOpen,
  onClose,
  onStatusChanged,
}: {
  row: MediaRow;
  thumb: string | undefined;
  isFresh: boolean;
  isActive: boolean;
  onOpen: () => void;
  onClose: () => void;
  onStatusChanged: (status: MediaStatus) => void;
}) {
  const [pending, startTransition] = useTransition();

  function run(nextStatus: MediaStatus) {
    startTransition(async () => {
      const res = await setMediaStatusAction({
        mediaId: row.id,
        status: nextStatus,
      });
      if (res.ok) {
        onStatusChanged(nextStatus);
        onClose();
      }
    });
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onOpen}
        className={`block w-full aspect-square rounded-2xl overflow-hidden bg-cream-100 transition ${
          row.status === "hidden" ? "opacity-40" : ""
        } ${isFresh ? "ring-2 ring-blush-500 ring-offset-2 ring-offset-cream-50" : ""}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : null}
      </button>

      {row.status === "hidden" ? (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-ink-900/80 text-white rounded px-1.5 py-0.5">
          Hidden
        </span>
      ) : null}
      {isFresh ? (
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-blush-500 text-white rounded px-1.5 py-0.5">
          New
        </span>
      ) : null}

      {isActive ? (
        <div
          className="fixed inset-0 z-50 bg-ink-900/70 flex items-center justify-center p-5"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-3xl shadow-soft p-4 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="w-full rounded-2xl bg-cream-100"
              />
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a
                href={`/api/admin/media/${row.id}/url`}
                className="rounded-xl bg-cream-100 px-3 py-2.5 text-center text-sm hover:bg-cream-200 transition"
              >
                Download
              </a>
              {row.status === "visible" ? (
                <button
                  type="button"
                  onClick={() => run("hidden")}
                  disabled={pending}
                  className="rounded-xl bg-cream-100 px-3 py-2.5 text-sm hover:bg-cream-200 disabled:opacity-60 transition"
                >
                  Hide
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run("visible")}
                  disabled={pending}
                  className="rounded-xl bg-cream-100 px-3 py-2.5 text-sm hover:bg-cream-200 disabled:opacity-60 transition"
                >
                  Unhide
                </button>
              )}
              <button
                type="button"
                onClick={() => run("deleted")}
                disabled={pending}
                className="rounded-xl bg-blush-400/15 text-blush-600 px-3 py-2.5 text-sm hover:bg-blush-400/25 disabled:opacity-60 transition"
              >
                Delete
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm text-ink-500 hover:text-ink-900 transition"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
