import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { upsertGuest } from "@/lib/db/guests";
import { getEventBySlug } from "@/lib/db/events";
import { takeToken, getClientIp } from "@/lib/rate-limit";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_AUDIO_MIMES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
] as const;
type AllowedAudio = (typeof ALLOWED_AUDIO_MIMES)[number];

const MAX_AUDIO_SIZE = 5 * 1024 * 1024; // 5 MB cap (~30s at 128 kbps WebM)

const EXT_FOR_AUDIO: Record<AllowedAudio, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
};

const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
  displayName: z.string().trim().min(1).max(64).optional().nullable(),
  audioMime: z.enum(ALLOWED_AUDIO_MIMES),
  audioSize: z.number().int().positive().max(MAX_AUDIO_SIZE),
});

// Share the same bucket as guest media — easier ops, same RLS posture.
const SIGN_RATE_LIMIT = { capacity: 20, refillPerSec: 0.5 } as const;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = takeToken(`audio-sign:${ip}`, SIGN_RATE_LIMIT);
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

  const messageId = randomUUID();
  const ext = EXT_FOR_AUDIO[parsed.audioMime as AllowedAudio];
  const path = `events/${event.id}/audio/${messageId}.${ext}`;

  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: "sign_failed", details: error?.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    messageId,
    eventId: event.id,
    guestId: guest.id,
    storagePath: path,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
