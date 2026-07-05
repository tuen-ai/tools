import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { signThumbnailUrls } from "@/lib/db/media";
import { takeToken, getClientIp } from "@/lib/rate-limit";
import { isVideoMime } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A guest's own uploads. The (eventSlug, clientFingerprint) pair is the
 * guest's soft identity — this only ever returns media rows whose guest_id
 * matches that fingerprint's guest, so the "gallery is private to the
 * couple" invariant holds: no guest can see another guest's photos.
 *
 * Exists because "did my upload actually work?" is a documented drop-off
 * point — guests who can't see their photo landed stop after one.
 */
const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
});

const MINE_RATE_LIMIT = { capacity: 10, refillPerSec: 0.2 } as const;
const MAX_ITEMS = 24;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = takeToken(`mine:${ip}`, MINE_RATE_LIMIT);
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

  const { data: guest } = await admin
    .from("guests")
    .select("id")
    .eq("event_id", event.id)
    .eq("client_fingerprint", parsed.clientFingerprint)
    .maybeSingle();
  if (!guest) {
    // First visit — nothing uploaded yet. Not an error.
    return NextResponse.json({ count: 0, items: [] });
  }

  const { data: media, count, error } = await admin
    .from("media")
    .select("id, storage_path, mime_type", { count: "exact" })
    .eq("guest_id", guest.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = media ?? [];
  const images = rows.filter((m) => !isVideoMime(m.mime_type));
  // Videos get an icon tile client-side — no point signing a full video
  // URL just for a 56px strip thumbnail.
  const signed = await signThumbnailUrls(admin, images, {
    width: 240,
    height: 240,
    quality: 60,
    expiresInSec: 600,
  });
  const urlById = new Map(signed.map((s) => [s.id, s.url]));

  return NextResponse.json({
    count: count ?? rows.length,
    items: rows.map((m) => ({
      id: m.id,
      kind: isVideoMime(m.mime_type) ? "video" : "image",
      url: urlById.get(m.id) ?? null,
    })),
  });
}
