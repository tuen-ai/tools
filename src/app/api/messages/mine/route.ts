import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { takeToken, getClientIp } from "@/lib/rate-limit";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A guest's own messages (text + voice), so the device remembers what it
 * sent and shows it back on the next visit — keyed on the (eventSlug,
 * fingerprint) soft identity, returning only this guest's rows. Voice gets
 * a signed 2h playback URL.
 */
const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
});

const RATE_LIMIT = { capacity: 10, refillPerSec: 0.2 } as const;

export async function POST(request: Request) {
  const rl = takeToken(`msg-mine:${getClientIp(request)}`, RATE_LIMIT);
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
    return NextResponse.json({ texts: [], voice: [] });
  }

  const { data: rows } = await admin
    .from("messages")
    .select("id, body, audio_path, created_at")
    .eq("event_id", event.id)
    .eq("guest_id", guest.id)
    .order("created_at", { ascending: true });

  const texts = (rows ?? [])
    .filter((r) => r.body && !r.audio_path)
    .map((r) => ({ id: r.id, body: r.body as string }));

  const voiceRows = (rows ?? []).filter((r) => r.audio_path);
  const voice = await Promise.all(
    voiceRows.map(async (r) => {
      const { data } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(r.audio_path as string, 2 * 60 * 60);
      return { id: r.id, url: data?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ texts, voice });
}
