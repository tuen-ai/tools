import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { deleteMessage } from "@/lib/db/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guest-side delete of a voice message they own. Ownership is proved by the
 * (eventSlug, clientFingerprint) pair matching the guest_id stored on the
 * message row. This lets a guest 重新錄製 (re-record) a clip — re-listen
 * uses the browser's native <audio> controls; deletion is the only action
 * that needs a server round-trip.
 *
 * We accept POST (instead of DELETE) so it works through every proxy /
 * fetch wrapper without preflight surprises.
 */
const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
});

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteCtx) {
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

  // Resolve which guest the (event, fingerprint) belongs to, then verify
  // they own this message. Two narrow lookups are cheaper than a join
  // and keep the ownership check explicit.
  const { data: guest } = await admin
    .from("guests")
    .select("id")
    .eq("event_id", event.id)
    .eq("client_fingerprint", parsed.clientFingerprint)
    .maybeSingle();
  if (!guest) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: msg } = await admin
    .from("messages")
    .select("id, guest_id, audio_path")
    .eq("id", id)
    .maybeSingle();
  if (!msg || msg.guest_id !== guest.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!msg.audio_path) {
    // Text-only messages don't have a guest-side delete path; bail rather
    // than silently widen the surface.
    return NextResponse.json({ error: "not_voice" }, { status: 400 });
  }

  try {
    await deleteMessage(admin, id);
  } catch (err) {
    return NextResponse.json(
      { error: "delete_failed", details: (err as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
