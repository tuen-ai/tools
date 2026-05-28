import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { upsertGuest, countGuestMedia } from "@/lib/db/guests";
import { getEventBySlug } from "@/lib/db/events";
import { insertMessage } from "@/lib/db/messages";
import { takeToken, getClientIp } from "@/lib/rate-limit";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  STORAGE_BUCKET,
  storagePathFor,
  type AllowedMime,
} from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FileSchema = z.object({
  mime: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
  displayName: z.string().trim().min(1).max(64).optional().nullable(),
  message: z.string().trim().min(1).max(500).optional().nullable(),
  files: z.array(FileSchema).min(1).max(MAX_FILES_PER_REQUEST),
});

// Burst 20 sign requests, then 1 every 2 seconds. A legit guest picking
// 10 photos at a time uses 1 token per batch, so even an enthusiastic
// uploader stays well under the cap.
const SIGN_RATE_LIMIT = { capacity: 20, refillPerSec: 0.5 } as const;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = takeToken(`sign:${ip}`, SIGN_RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", details: (err as Error).message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const event = await getEventBySlug(admin, parsed.eventSlug);
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }
  if (!event.upload_enabled) {
    return NextResponse.json({ error: "uploads_closed" }, { status: 403 });
  }

  const guest = await upsertGuest(admin, {
    eventId: event.id,
    clientFingerprint: parsed.clientFingerprint,
    displayName: parsed.displayName ?? null,
  });

  // Optional message — insert before quota check so even if the guest is
  // at their photo limit the couple still receives their note.
  if (parsed.message) {
    try {
      await insertMessage(admin, {
        eventId: event.id,
        guestId: guest.id,
        body: parsed.message,
      });
    } catch (err) {
      // Don't block uploads on a message-insert failure.
      console.error("Failed to insert guest message", err);
    }
  }

  const existingCount = await countGuestMedia(admin, guest.id);
  if (existingCount + parsed.files.length > event.max_uploads_per_guest) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        max: event.max_uploads_per_guest,
        used: existingCount,
      },
      { status: 429 },
    );
  }

  const items = await Promise.all(
    parsed.files.map(async (f) => {
      const mediaId = randomUUID();
      const path = storagePathFor(event.id, mediaId, f.mime as AllowedMime);

      const { data, error } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        throw new Error(`Failed to mint signed URL: ${error?.message}`);
      }

      return {
        mediaId,
        storagePath: path,
        signedUrl: data.signedUrl,
        token: data.token,
      };
    }),
  );

  return NextResponse.json({
    eventId: event.id,
    guestId: guest.id,
    items,
  });
}
