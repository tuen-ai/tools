import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { insertMessage } from "@/lib/db/messages";
import { takeToken, getClientIp } from "@/lib/rate-limit";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  messageId: z.string().uuid(),
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  storagePath: z.string().min(1),
  audioSize: z.number().int().positive(),
  body: z.string().trim().min(1).max(500).optional().nullable(),
});

const FINALIZE_RATE_LIMIT = { capacity: 20, refillPerSec: 0.5 } as const;

export async function POST(request: Request) {
  const rl = takeToken(
    `audio-finalize:${getClientIp(request)}`,
    FINALIZE_RATE_LIMIT,
  );
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

  // Pin the object to THIS event's audio folder + the claimed messageId,
  // so a client can't file audio under another event or a foreign id.
  const expectedPrefix = `events/${parsed.eventId}/audio/${parsed.messageId}.`;
  if (!parsed.storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "path_mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The guest row must belong to this event.
  const { data: guest } = await admin
    .from("guests")
    .select("id, event_id")
    .eq("id", parsed.guestId)
    .maybeSingle();
  if (!guest || guest.event_id !== parsed.eventId) {
    return NextResponse.json({ error: "guest_mismatch" }, { status: 403 });
  }

  const folder = parsed.storagePath.substring(
    0,
    parsed.storagePath.lastIndexOf("/"),
  );
  const filename = parsed.storagePath.substring(folder.length + 1);

  const { data: listing, error: listErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: filename, limit: 1 });
  if (listErr) {
    console.error("audio finalize storage list failed", listErr.message);
    return NextResponse.json({ error: "storage_error" }, { status: 502 });
  }
  const object = listing?.find((o) => o.name === filename);
  if (!object) {
    return NextResponse.json({ error: "object_not_found" }, { status: 404 });
  }
  const actualSize = (object.metadata as { size?: number } | null)?.size;
  if (typeof actualSize === "number" && actualSize !== parsed.audioSize) {
    return NextResponse.json(
      { error: "size_mismatch", expected: parsed.audioSize, actual: actualSize },
      { status: 400 },
    );
  }

  try {
    const { id } = await insertMessage(admin, {
      id: parsed.messageId,
      eventId: parsed.eventId,
      guestId: parsed.guestId,
      body: parsed.body ?? null,
      audioPath: parsed.storagePath,
    });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("audio finalize insert failed", (err as Error).message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
}
