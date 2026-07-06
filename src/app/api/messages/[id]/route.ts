import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { deleteMessage } from "@/lib/db/messages";
import { takeToken, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guest-side delete of a message they left — text OR voice. Ownership is
 * proved by the (eventSlug, clientFingerprint) pair matching the message's
 * guest_id. (Static sibling routes /text, /mine, /audio/* take priority
 * over this [id] segment, so this only ever receives a real message uuid.)
 */
const BodySchema = z.object({
  eventSlug: z.string().min(1).max(64),
  clientFingerprint: z.string().uuid(),
});

const RATE_LIMIT = { capacity: 20, refillPerSec: 0.5 } as const;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteCtx) {
  const rl = takeToken(`msg-del:${getClientIp(request)}`, RATE_LIMIT);
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

  const { data: msg } = await admin
    .from("messages")
    .select("id, guest_id, event_id")
    .eq("id", id)
    .maybeSingle();
  if (!msg || msg.guest_id !== guest.id || msg.event_id !== event.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await deleteMessage(admin, event.id, id);
  } catch (err) {
    console.error("guest message delete failed", (err as Error).message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
