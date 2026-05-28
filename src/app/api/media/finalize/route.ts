import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { insertMedia } from "@/lib/db/media";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
} from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  mediaId: z.string().uuid(),
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  storagePath: z.string().min(1),
  mime: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
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

  // Defensive: storage path must include the claimed mediaId.
  if (!parsed.storagePath.includes(parsed.mediaId)) {
    return NextResponse.json({ error: "path_mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the object actually exists in storage and matches the claimed size.
  // list() with a search filter is the cheapest way to HEAD an object — no
  // download needed.
  const folder = parsed.storagePath.substring(
    0,
    parsed.storagePath.lastIndexOf("/"),
  );
  const filename = parsed.storagePath.substring(folder.length + 1);

  const { data: listing, error: listError } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: filename, limit: 1 });

  if (listError) {
    return NextResponse.json(
      { error: "storage_error", details: listError.message },
      { status: 502 },
    );
  }

  const object = listing?.find((o) => o.name === filename);
  if (!object) {
    return NextResponse.json({ error: "object_not_found" }, { status: 404 });
  }

  const actualSize = (object.metadata as { size?: number } | null)?.size;
  if (typeof actualSize === "number" && actualSize !== parsed.size) {
    return NextResponse.json(
      { error: "size_mismatch", expected: parsed.size, actual: actualSize },
      { status: 400 },
    );
  }

  try {
    const { id } = await insertMedia(admin, {
      id: parsed.mediaId,
      event_id: parsed.eventId,
      guest_id: parsed.guestId,
      storage_path: parsed.storagePath,
      mime_type: parsed.mime,
      size_bytes: parsed.size,
      width: parsed.width ?? null,
      height: parsed.height ?? null,
      status: "visible",
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: "insert_failed", details: (err as Error).message },
      { status: 500 },
    );
  }
}
