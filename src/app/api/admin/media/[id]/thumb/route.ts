import { NextResponse } from "next/server";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMedia,
  signThumbnailUrls,
  ADMIN_THUMB_TTL_SEC,
} from "@/lib/db/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  const admin = createAdminClient();
  const media = await getMedia(admin, id);
  if (!media) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await assertEventAdmin(media.event_id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const [thumb] = await signThumbnailUrls(admin, [media], {
    expiresInSec: ADMIN_THUMB_TTL_SEC,
  });
  return NextResponse.json({ url: thumb.url });
}
