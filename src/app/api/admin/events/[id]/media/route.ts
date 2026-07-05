import { NextResponse } from "next/server";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listMediaPage,
  signThumbnailUrls,
  ADMIN_THUMB_TTL_SEC,
} from "@/lib/db/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100_000),
  limit: z.coerce.number().int().min(1).max(120),
  table: z.string().uuid().optional(),
  challenge: z.string().uuid().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id: eventId } = await params;
  try {
    await assertEventAdmin(eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    offset: url.searchParams.get("offset") ?? "0",
    limit: url.searchParams.get("limit") ?? "60",
    table: url.searchParams.get("table") ?? undefined,
    challenge: url.searchParams.get("challenge") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const admin = createAdminClient();
  const page = await listMediaPage(admin, {
    eventId,
    offset: parsed.data.offset,
    limit: parsed.data.limit,
    tableId: parsed.data.table,
    challengeId: parsed.data.challenge,
  });
  const thumbs = await signThumbnailUrls(admin, page.rows, {
    expiresInSec: ADMIN_THUMB_TTL_SEC,
  });

  return NextResponse.json({
    rows: page.rows,
    thumbs: Object.fromEntries(thumbs.map((t) => [t.id, t.url])),
    total: page.total,
  });
}
