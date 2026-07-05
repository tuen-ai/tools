import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { insertMedia } from "@/lib/db/media";
import { getEventById } from "@/lib/db/events";
import { takeToken, getClientIp } from "@/lib/rate-limit";
import {
  ALLOWED_MIME_TYPES,
  MAX_VIDEO_SIZE_BYTES,
  STORAGE_BUCKET,
  maxSizeFor,
  storagePathFor,
  type AllowedMime,
} from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    mediaId: z.string().uuid(),
    eventId: z.string().uuid(),
    guestId: z.string().uuid(),
    tableId: z.string().uuid().optional().nullable(),
    challengeId: z.string().uuid().optional().nullable(),
    storagePath: z.string().min(1),
    mime: z.enum(ALLOWED_MIME_TYPES),
    size: z.number().int().positive().max(MAX_VIDEO_SIZE_BYTES),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .refine((b) => b.size <= maxSizeFor(b.mime), {
    message: "file_too_large_for_mime",
  });

// Generous: a legit 10-file batch fires ~10 finalize calls in a burst.
const FINALIZE_RATE_LIMIT = { capacity: 40, refillPerSec: 1 } as const;

export async function POST(request: Request) {
  const rl = takeToken(`finalize:${getClientIp(request)}`, FINALIZE_RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // The storage path is fully determined by (eventId, mediaId, mime), so
  // an exact match pins the object to THIS event's folder AND ties the
  // claimed mime to the path extension in one check — preventing a guest
  // with upload access to event A from finalizing their object into event
  // B's gallery, or mislabelling a .jpg as video/mp4.
  const expectedPath = storagePathFor(
    parsed.eventId,
    parsed.mediaId,
    parsed.mime as AllowedMime,
  );
  if (parsed.storagePath !== expectedPath) {
    return NextResponse.json({ error: "path_mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The event must exist and still be accepting uploads, and the guest row
  // must belong to this event. (A client holding a still-valid signed URL
  // could otherwise land media after the couple closed uploads, or file it
  // under a guest id from another event.)
  const [event, guestRes] = await Promise.all([
    getEventById(admin, parsed.eventId),
    admin
      .from("guests")
      .select("id, event_id")
      .eq("id", parsed.guestId)
      .maybeSingle(),
  ]);
  if (!event || !event.upload_enabled) {
    return NextResponse.json({ error: "uploads_closed" }, { status: 403 });
  }
  if (!guestRes.data || guestRes.data.event_id !== parsed.eventId) {
    return NextResponse.json({ error: "guest_mismatch" }, { status: 403 });
  }

  // Verify the object actually exists in storage and matches the claimed size.
  // list() with a search filter is the cheapest way to HEAD an object — no
  // download needed.
  const folder = parsed.storagePath.substring(
    0,
    parsed.storagePath.lastIndexOf("/"),
  );
  const filename = parsed.storagePath.substring(folder.length + 1);

  const { data: listing, error: listError } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: filename, limit: 1 });

  if (listError) {
    console.error("finalize storage list failed", listError.message);
    return NextResponse.json({ error: "storage_error" }, { status: 502 });
  }

  const object = listing?.find((o) => o.name === filename);
  if (!object) {
    return NextResponse.json({ error: "object_not_found" }, { status: 404 });
  }

  const actualSize = (object.metadata as { size?: number } | null)?.size;
  if (typeof actualSize === "number" && actualSize !== parsed.size) {
    return NextResponse.json(
      { error: "size_mismatch", expected: parsed.size, actual: actualSize },
      { status: 400 },
    );
  }

  try {
    const { id } = await insertMedia(admin, {
      id: parsed.mediaId,
      event_id: parsed.eventId,
      guest_id: parsed.guestId,
      table_id: parsed.tableId ?? null,
      challenge_id: parsed.challengeId ?? null,
      storage_path: parsed.storagePath,
      mime_type: parsed.mime,
      size_bytes: parsed.size,
      width: parsed.width ?? null,
      height: parsed.height ?? null,
      status: "visible",
    });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("finalize insert failed", (err as Error).message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
