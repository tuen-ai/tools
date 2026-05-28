"use client";

import { useState, useTransition } from "react";

import type { Database, MediaStatus } from "@/types/database";
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

export function MediaGrid({
  eventId,
  initialRows,
  initialThumbs,
  total,
  pageSize,
}: Props) {
  const [rows, setRows] = useState<MediaRow[]>(initialRows);
  const [thumbs, setThumbs] = useState<Record<string, string>>(initialThumbs);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    } finally {
      setLoadingMore(false);
    }
  }

  if (visibleRows.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-cream-200 p-10 text-center">
        <div className="text-4xl mb-3" aria-hidden>
          📷
        </div>
        <p className="text-ink-500 text-sm">
          No photos yet. Share the QR code with your guests to start.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visibleRows.map((row) => (
          <MediaTile
            key={row.id}
            row={row}
            thumb={thumbs[row.id]}
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

function MediaTile({
  row,
  thumb,
  isActive,
  onOpen,
  onClose,
  onStatusChanged,
}: {
  row: MediaRow;
  thumb: string | undefined;
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
        className={`block w-full aspect-square rounded-2xl overflow-hidden bg-cream-100 ${
          row.status === "hidden" ? "opacity-40" : ""
        }`}
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
