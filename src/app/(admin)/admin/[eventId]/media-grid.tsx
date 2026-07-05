"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { Database, MediaStatus } from "@/types/database";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ADMIN_DICT, type AdminDict } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import {
  CameraIcon,
  PlayIcon,
  TableIcon,
  SparkleIcon,
  DownloadIcon,
  EyeOffIcon,
  CheckIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { setMediaStatusAction } from "./actions";

type MediaRow = Database["public"]["Tables"]["media"]["Row"];

// Backstop for an expired/failed thumbnail signed URL: fetch a fresh one
// once (guarded against loops) and swap it in imperatively.
function refetchThumb(
  el: HTMLImageElement | HTMLVideoElement,
  mediaId: string,
) {
  if (el.dataset.retried) return;
  el.dataset.retried = "1";
  fetch(`/api/admin/media/${mediaId}/thumb`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { url?: string } | null) => {
      if (d?.url) el.src = d.url;
    })
    .catch(() => {});
}

export interface TableOption {
  id: string;
  label: string;
}

export interface ChallengeOption {
  id: string;
  prompt: string;
}

interface Props {
  lang: Lang;
  eventId: string;
  initialRows: MediaRow[];
  initialThumbs: Record<string, string>;
  total: number;
  pageSize: number;
  tables: TableOption[];
  challenges: ChallengeOption[];
}

interface MorePageResponse {
  rows: MediaRow[];
  thumbs: Record<string, string>;
  total: number;
}

const FRESH_HIGHLIGHT_MS = 4000;

export function MediaGrid({
  lang,
  eventId,
  initialRows,
  initialThumbs,
  total: initialTotal,
  pageSize,
  tables,
  challenges,
}: Props) {
  const t = ADMIN_DICT[lang];
  const [rows, setRows] = useState<MediaRow[]>(initialRows);
  const [thumbs, setThumbs] = useState<Record<string, string>>(initialThumbs);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("connecting");
  // null = all tables. Switching refetches page 1 with the filter applied.
  const [tableFilter, setTableFilter] = useState<string | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const tableLabelById = new Map(tables.map((tb) => [tb.id, tb.label]));
  const challengePromptById = new Map(challenges.map((c) => [c.id, c.prompt]));

  // Refs let the realtime callbacks read current state without re-subscribing
  // every render.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const tableFilterRef = useRef(tableFilter);
  tableFilterRef.current = tableFilter;

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
          // Respect the active table filter — a photo from another table
          // shouldn't pop into a filtered view.
          const filter = tableFilterRef.current;
          if (filter && row.table_id !== filter) return;

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

  function pageUrl(offset: number, tableId: string | null): string {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(pageSize),
    });
    if (tableId) params.set("table", tableId);
    return `/api/admin/events/${eventId}/media?${params.toString()}`;
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      // Offset must match the server ordering, which excludes soft-deleted
      // rows. `rows` still holds locally-deleted rows (kept so an undo is
      // possible), so page on visibleRows.length, not rows.length — else
      // each delete inflates the offset and silently skips visible photos.
      const res = await fetch(pageUrl(visibleRows.length, tableFilter));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MorePageResponse;
      setRows((prev) => [...prev, ...data.rows]);
      setThumbs((prev) => ({ ...prev, ...data.thumbs }));
      setTotal(data.total);
    } finally {
      setLoadingMore(false);
    }
  }

  async function applyFilter(tableId: string | null) {
    if (tableId === tableFilter || filterLoading) return;
    setTableFilter(tableId);
    setFilterLoading(true);
    try {
      const res = await fetch(pageUrl(0, tableId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MorePageResponse;
      setRows(data.rows);
      setThumbs((prev) => ({ ...prev, ...data.thumbs }));
      setTotal(data.total);
    } finally {
      setFilterLoading(false);
    }
  }

  return (
    <>
      <LiveBadge status={liveStatus} count={total} t={t} />

      {tables.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group">
          <FilterChip
            label={t.filterAll}
            active={tableFilter === null}
            disabled={filterLoading}
            onClick={() => applyFilter(null)}
          />
          {tables.map((tb) => (
            <FilterChip
              key={tb.id}
              label={tb.label}
              withIcon
              active={tableFilter === tb.id}
              disabled={filterLoading}
              onClick={() => applyFilter(tb.id)}
            />
          ))}
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-cream-200 p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-ink-500">
            <CameraIcon className="h-6 w-6" />
          </div>
          <p className="text-ink-700 text-sm">
            {tableFilter ? t.gridEmptyFiltered : t.gridEmpty}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visibleRows.map((row) => (
            <MediaTile
              key={row.id}
              t={t}
              row={row}
              thumb={thumbs[row.id]}
              tableLabel={
                row.table_id ? (tableLabelById.get(row.table_id) ?? null) : null
              }
              challengePrompt={
                row.challenge_id
                  ? (challengePromptById.get(row.challenge_id) ?? null)
                  : null
              }
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
              ? t.loadingMore
              : t.loadMore(total - visibleRows.length)}
          </button>
        </div>
      ) : null}
    </>
  );
}

function LiveBadge({
  status,
  count,
  t,
}: {
  status: "connecting" | "live" | "offline";
  count: number;
  t: AdminDict;
}) {
  const dot =
    status === "live"
      ? "bg-sage-500"
      : status === "offline"
        ? "bg-blush-600"
        : "bg-ink-500/50";
  const label =
    status === "live"
      ? t.liveLive
      : status === "offline"
        ? t.liveOffline
        : t.liveConnecting;

  return (
    <div className="flex items-center justify-between text-sm text-ink-700">
      <span>{t.photoCount(count)}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
    </div>
  );
}

function FilterChip({
  label,
  withIcon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  withIcon?: boolean;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition disabled:opacity-60 ${
        active
          ? "bg-ink-900 text-white"
          : "border border-cream-200 bg-white text-ink-700 hover:border-blush-400"
      }`}
    >
      {withIcon ? <TableIcon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function MediaTile({
  t,
  row,
  thumb,
  tableLabel,
  challengePrompt,
  isFresh,
  isActive,
  onOpen,
  onClose,
  onStatusChanged,
}: {
  t: AdminDict;
  row: MediaRow;
  thumb: string | undefined;
  tableLabel: string | null;
  challengePrompt: string | null;
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

  const isVideo = row.mime_type.startsWith("video/");

  return (
    <div className="relative group animate-[fadeup_400ms_ease-out]">
      <button
        type="button"
        onClick={onOpen}
        className={`block w-full aspect-square rounded-2xl overflow-hidden bg-cream-100 transition ${
          row.status === "hidden" ? "opacity-40" : ""
        } ${isFresh ? "ring-2 ring-blush-500 ring-offset-2 ring-offset-cream-50" : ""}`}
      >
        {thumb && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onError={(e) => refetchThumb(e.currentTarget, row.id)}
            className="w-full h-full object-cover"
          />
        ) : null}
        {thumb && isVideo ? (
          <video
            src={thumb}
            onError={(e) => refetchThumb(e.currentTarget, row.id)}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : null}
      </button>

      {isVideo ? (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-ink-900/80 text-white rounded px-1.5 py-0.5 pointer-events-none">
          <PlayIcon className="h-3 w-3" />
          {t.tileVideo}
        </span>
      ) : null}
      {tableLabel ? (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] bg-white/85 text-ink-700 rounded px-1.5 py-0.5 pointer-events-none backdrop-blur-sm">
          <TableIcon className="h-3 w-3" />
          {tableLabel}
        </span>
      ) : null}
      {challengePrompt ? (
        // Sits above the video badge (bottom-8) when both are present.
        <span
          className={`absolute ${
            isVideo ? "bottom-8" : "bottom-2"
          } left-2 inline-flex max-w-[85%] items-center gap-1 text-[10px] bg-blush-500/90 text-white rounded px-1.5 py-0.5 pointer-events-none`}
          title={challengePrompt}
        >
          <SparkleIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{challengePrompt}</span>
        </span>
      ) : null}
      {row.status === "hidden" ? (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-ink-900/80 text-white rounded px-1.5 py-0.5">
          {t.tileHidden}
        </span>
      ) : null}
      {isFresh ? (
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-blush-500 text-white rounded px-1.5 py-0.5 animate-[pop_400ms_ease-out]">
          {t.tileNew}
        </span>
      ) : null}

      {isActive ? (
        <div
          className="fixed inset-0 z-50 bg-ink-900/85 flex items-center justify-center p-5 animate-[fadein_200ms_ease-out]"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-3xl shadow-soft p-4 max-w-md w-full animate-[pop_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {thumb && !isVideo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="w-full rounded-2xl bg-cream-100"
              />
            ) : null}
            {thumb && isVideo ? (
              <video
                src={thumb}
                controls
                autoPlay
                playsInline
                className="w-full rounded-2xl bg-black aspect-video"
              />
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a
                href={`/api/admin/media/${row.id}/url`}
                className="inline-flex flex-col items-center gap-1 rounded-xl bg-cream-100 px-3 py-2.5 text-center text-sm hover:bg-cream-200 transition"
              >
                <DownloadIcon className="h-4 w-4" />
                {t.modalDownload}
              </a>
              {row.status === "visible" ? (
                <button
                  type="button"
                  onClick={() => run("hidden")}
                  disabled={pending}
                  className="inline-flex flex-col items-center gap-1 rounded-xl bg-cream-100 px-3 py-2.5 text-sm hover:bg-cream-200 disabled:opacity-60 transition"
                >
                  <EyeOffIcon className="h-4 w-4" />
                  {t.modalHide}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run("visible")}
                  disabled={pending}
                  className="inline-flex flex-col items-center gap-1 rounded-xl bg-cream-100 px-3 py-2.5 text-sm hover:bg-cream-200 disabled:opacity-60 transition"
                >
                  <CheckIcon className="h-4 w-4" />
                  {t.modalUnhide}
                </button>
              )}
              <button
                type="button"
                onClick={() => run("deleted")}
                disabled={pending}
                className="inline-flex flex-col items-center gap-1 rounded-xl bg-blush-400/15 text-blush-700 px-3 py-2.5 text-sm hover:bg-blush-400/25 disabled:opacity-60 transition"
              >
                <TrashIcon className="h-4 w-4" />
                {t.modalDelete}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm text-ink-500 hover:text-ink-900 transition"
            >
              {t.modalClose}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
