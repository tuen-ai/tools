import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MediaStatus } from "@/types/database";

import { STORAGE_BUCKET, isVideoMime } from "@/lib/upload/constants";

type MediaRow = Database["public"]["Tables"]["media"]["Row"];

export async function insertMedia(
  admin: SupabaseClient<Database>,
  row: Database["public"]["Tables"]["media"]["Insert"],
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("media")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export interface ListMediaPageArgs {
  eventId: string;
  /** Inclusive offset (zero-based). */
  offset: number;
  /** Page size. */
  limit: number;
  /** Defaults to ['visible', 'hidden'] — admins don't see 'deleted'. */
  statuses?: MediaStatus[];
  /** When set, only media tagged with this table. */
  tableId?: string;
}

export interface MediaPage {
  rows: MediaRow[];
  total: number;
}

export async function listMediaPage(
  client: SupabaseClient<Database>,
  { eventId, offset, limit, statuses, tableId }: ListMediaPageArgs,
): Promise<MediaPage> {
  const filterStatuses = statuses ?? ["visible", "hidden"];
  let q = client
    .from("media")
    .select("*", { count: "exact" })
    .eq("event_id", eventId)
    .in("status", filterStatuses);
  if (tableId) q = q.eq("table_id", tableId);
  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function setMediaStatus(
  admin: SupabaseClient<Database>,
  id: string,
  status: MediaStatus,
): Promise<MediaRow> {
  const { data, error } = await admin
    .from("media")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getMedia(
  client: SupabaseClient<Database>,
  id: string,
): Promise<MediaRow | null> {
  const { data, error } = await client
    .from("media")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface SignedThumb {
  id: string;
  url: string;
}

/**
 * Batch-mint signed URLs for a page of media. For images, applies a
 * Supabase image transform (resize + quality). For videos, returns the
 * original signed URL — the caller renders a <video> tag.
 */
export async function signThumbnailUrls(
  admin: SupabaseClient<Database>,
  rows: Pick<MediaRow, "id" | "storage_path" | "mime_type">[],
  options: {
    width?: number;
    height?: number;
    quality?: number;
    expiresInSec?: number;
  } = {},
): Promise<SignedThumb[]> {
  const expiresIn = options.expiresInSec ?? 300; // 5 minutes
  return Promise.all(
    rows.map(async (row) => {
      const isVid = isVideoMime(row.mime_type);
      const opts = isVid
        ? {}
        : {
            transform: {
              width: options.width ?? 400,
              height: options.height ?? 400,
              resize: "cover" as const,
              quality: options.quality ?? 70,
            },
          };
      const { data, error } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(row.storage_path, expiresIn, opts);
      if (error || !data) {
        throw new Error(`Signed URL failed for ${row.id}: ${error?.message}`);
      }
      return { id: row.id, url: data.signedUrl };
    }),
  );
}

export async function signOriginalUrl(
  admin: SupabaseClient<Database>,
  storagePath: string,
  expiresInSec = 300,
): Promise<string> {
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSec, { download: true });
  if (error || !data) {
    throw new Error(`Signed URL failed: ${error?.message}`);
  }
  return data.signedUrl;
}
