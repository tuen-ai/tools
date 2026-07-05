import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { setMediaStatus } from "@/lib/db/media";
import { takeToken, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guest-side soft-delete of a photo/video they uploaded. Ownership is proved
 * by the (eventSlug, clientFingerprint) pair matching the media row's
 * guest_id — mirrors the voice-clip delete. Sets status='deleted' (the cron
 * hard-deletes later), so an accidental upload (wrong photo, someone's kid)
 * can be retracted by the guest without involving the couple.
 *
 * POST (not DELETE) so it works through every fetch wrapper / proxy without
 * preflight surprises.
 */
const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
});

const DELETE_RATE_LIMIT = { capacity: 20, refillPerSec: 0.5 } as const;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteCtx) {
  const rl = takeToken(`media-del:${getClientIp(request)}`, DELETE_RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
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

  const { data: guest } = await admin
    .from("guests")
    .select("id")
    .eq("event_id", event.id)
    .eq("client_fingerprint", parsed.clientFingerprint)
    .maybeSingle();
  if (!guest) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // The media row must belong to this guest AND this event.
  const { data: media } = await admin
    .from("media")
    .select("id, guest_id, event_id")
    .eq("id", id)
    .maybeSingle();
  if (!media || media.guest_id !== guest.id || media.event_id !== event.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await setMediaStatus(admin, id, "deleted");
  } catch (err) {
    console.error("guest media delete failed", (err as Error).message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
