"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

const PAGE = 100;

export interface CleanupResult {
  ok: boolean;
  orphansDeleted?: number;
  staleDeleted?: number;
  error?: string;
}

const Schema = z.object({ eventId: z.string().uuid() });

/**
 * Removes:
 *   1. Orphaned storage objects under events/<eventId>/ that have no
 *      corresponding media row (left over from failed finalize calls).
 *   2. Media rows soft-deleted by an admin (status='deleted'), and their
 *      storage objects.
 *
 * Triggered manually by an admin from the settings page. This is
 * destructive — there's no grace period — but the admin explicitly opts
 * in by clicking the button.
 */
export async function cleanupStorageAction(
  input: z.input<typeof Schema>,
): Promise<CleanupResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  const { eventId } = parsed.data;

  try {
    await assertEventAdmin(eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const admin = createAdminClient();
  const folder = `events/${eventId}`;

  // 1. Enumerate storage objects (paginated; list() caps at 100 per call).
  const storageNames: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(folder, { limit: PAGE, offset });
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) break;
    storageNames.push(...data.map((d) => d.name));
    if (data.length < PAGE) break;
  }
  // 2. Fetch all media rows for this event.
  const { data: media, error: mediaErr } = await admin
    .from("media")
    .select("id, storage_path, status")
    .eq("event_id", eventId);
  if (mediaErr) return { ok: false, error: mediaErr.message };

  // The cover image lives at events/<id>/cover.<ext> and is tracked on the
  // events row, NOT in media — so it must never be treated as an orphan.
  const { data: ev } = await admin
    .from("events")
    .select("cover_image_path")
    .eq("id", eventId)
    .single();
  const coverPath = ev?.cover_image_path ?? null;

  const rowsByPath = new Map((media ?? []).map((m) => [m.storage_path, m]));

  // 3. Orphan: a top-level media object (<uuid>.<ext>) with no DB row.
  //    Restricting to the media filename shape also skips the "audio"
  //    subfolder entry and any future non-media object at this prefix.
  const ORPHAN_RE = /^[0-9a-f-]{36}\.[a-z0-9]+$/i;
  const orphanPaths: string[] = [];
  for (const name of storageNames) {
    const path = `${folder}/${name}`;
    if (path === coverPath) continue;
    if (!ORPHAN_RE.test(name)) continue;
    if (!rowsByPath.has(path)) orphanPaths.push(path);
  }

  // 4. Stale-deleted: DB rows marked deleted.
  const staleRows = (media ?? []).filter((m) => m.status === "deleted");

  // Storage.remove() accepts an array; chunk to be safe.
  const allRemovalPaths = [
    ...orphanPaths,
    ...staleRows.map((r) => r.storage_path),
  ];

  if (allRemovalPaths.length > 0) {
    // Chunks of 100 — undocumented practical limit on storage.remove().
    for (let i = 0; i < allRemovalPaths.length; i += PAGE) {
      const chunk = allRemovalPaths.slice(i, i + PAGE);
      const { error } = await admin.storage.from(STORAGE_BUCKET).remove(chunk);
      if (error) return { ok: false, error: error.message };
    }
  }

  if (staleRows.length > 0) {
    const ids = staleRows.map((r) => r.id);
    const { error } = await admin.from("media").delete().in("id", ids);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/${eventId}`);
  revalidatePath(`/admin/${eventId}/settings`);

  return {
    ok: true,
    orphansDeleted: orphanPaths.length,
    staleDeleted: staleRows.length,
  };
}
