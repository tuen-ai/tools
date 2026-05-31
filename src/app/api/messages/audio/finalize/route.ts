import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { insertMessage } from "@/lib/db/messages";
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

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", details: (err as Error).message },
      { status: 400 },
    );
  }

  if (!parsed.storagePath.includes(parsed.messageId)) {
    return NextResponse.json({ error: "path_mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();

  const folder = parsed.storagePath.substring(
    0,
    parsed.storagePath.lastIndexOf("/"),
  );
  const filename = parsed.storagePath.substring(folder.length + 1);

  const { data: listing, error: listErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: filename, limit: 1 });
  if (listErr) {
    return NextResponse.json(
      { error: "storage_error", details: listErr.message },
      { status: 502 },
    );
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
      eventId: parsed.eventId,
      guestId: parsed.guestId,
      body: parsed.body ?? null,
      audioPath: parsed.storagePath,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: "insert_failed", details: (err as Error).message },
      { status: 500 },
    );
  }
}
