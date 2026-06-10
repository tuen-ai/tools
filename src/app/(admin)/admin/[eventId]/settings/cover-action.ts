"use server";

import "server-only";
import { revalidatePath } from "next/cache";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEvent } from "@/lib/db/events";
import {
  ALLOWED_IMAGE_MIMES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
  extForMime,
  type AllowedImageMime,
} from "@/lib/upload/constants";

export interface CoverActionResult {
  ok: boolean;
  error?: string;
}

function isImageMime(s: string): s is AllowedImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(s);
}

export async function uploadCoverAction(
  _prev: CoverActionResult,
  formData: FormData,
): Promise<CoverActionResult> {
  const eventId = formData.get("eventId");
  const file = formData.get("file");

  if (typeof eventId !== "string" || !eventId) {
    return { ok: false, error: "invalid_request" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "no_file" };
  }
  if (!isImageMime(file.type)) {
    return { ok: false, error: "unsupported_format" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  try {
    await assertEventAdmin(eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const admin = createAdminClient();
  const path = `events/${eventId}/cover.${extForMime(file.type)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  const event = await updateEvent(admin, eventId, { cover_image_path: path });

  revalidatePath(`/admin/${eventId}`);
  revalidatePath(`/admin/${eventId}/settings`);
  revalidatePath(`/e/${event.slug}`); // guest page is keyed by slug, not id
  return { ok: true };
}

export async function removeCoverAction(
  _prev: CoverActionResult,
  formData: FormData,
): Promise<CoverActionResult> {
  const eventId = formData.get("eventId");
  if (typeof eventId !== "string" || !eventId) {
    return { ok: false, error: "invalid_request" };
  }
  try {
    await assertEventAdmin(eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const admin = createAdminClient();

  // Find and remove any cover files for this event.
  const { data: list } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(`events/${eventId}`, { search: "cover", limit: 5 });
  if (list && list.length > 0) {
    await admin.storage
      .from(STORAGE_BUCKET)
      .remove(list.map((o) => `events/${eventId}/${o.name}`));
  }

  const event = await updateEvent(admin, eventId, { cover_image_path: null });
  revalidatePath(`/admin/${eventId}/settings`);
  revalidatePath(`/e/${event.slug}`);
  return { ok: true };
}
