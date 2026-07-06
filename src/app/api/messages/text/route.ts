import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { upsertGuest } from "@/lib/db/guests";
import { insertMessage } from "@/lib/db/messages";
import { takeToken, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standalone text guest-book message — so a guest can leave a well-wish
 * WITHOUT also uploading photos (previously the text note only rode along
 * with an upload batch, mirroring how voice clips already send on their
 * own). Returns the created id so the client can show it back as a tile.
 */
const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
  displayName: z.string().trim().min(1).max(64).optional().nullable(),
  body: z.string().trim().min(1).max(500),
});

const RATE_LIMIT = { capacity: 10, refillPerSec: 0.2 } as const;

export async function POST(request: Request) {
  const rl = takeToken(`msg-text:${getClientIp(request)}`, RATE_LIMIT);
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

  try {
    const { id } = await insertMessage(admin, {
      eventId: event.id,
      guestId: guest.id,
      body: parsed.body,
    });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("text message insert failed", (err as Error).message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
