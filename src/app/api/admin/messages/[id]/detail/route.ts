import { NextResponse } from "next/server";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Realtime INSERT payloads don't carry the joined guests row or a usable
// audio URL (the bucket is private). The messages panel calls this after
// each INSERT event to hydrate the new row.

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  const admin = createAdminClient();
  const { data: message, error } = await admin
    .from("messages")
    .select("event_id, audio_path, guests(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!message) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await assertEventAdmin(message.event_id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let audioUrl: string | null = null;
  if (message.audio_path) {
    const { data: signed } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(message.audio_path, 1800);
    audioUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    displayName: message.guests?.display_name ?? null,
    audioUrl,
  });
}
