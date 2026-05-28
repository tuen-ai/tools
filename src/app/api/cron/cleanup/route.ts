import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard-deletes media rows whose status has been 'deleted' for this long.
const GRACE_PERIOD_DAYS = 7;
const CHUNK = 100;

/**
 * Hard-delete media that's been soft-deleted past the grace window.
 *
 * Two ways to invoke:
 *   - Vercel cron — add to vercel.json:
 *       { "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }] }
 *     Vercel sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 *   - GitHub Actions / external scheduler — POST the same header.
 *
 * The endpoint is disabled (401) until CRON_SECRET is configured.
 */
export async function GET(request: Request) {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_disabled" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows, error } = await admin
    .from("media")
    .select("id, storage_path")
    .eq("status", "deleted")
    .lt("deleted_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ removed: 0 });
  }

  const paths = rows.map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += CHUNK) {
    const chunk = paths.slice(i, i + CHUNK);
    const { error: rmErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .remove(chunk);
    if (rmErr) {
      // Surface and stop — admin can re-trigger; partial progress is fine
      // because rows still exist for whatever we couldn't remove.
      return NextResponse.json(
        { error: rmErr.message, removed: i },
        { status: 500 },
      );
    }
  }

  const ids = rows.map((r) => r.id);
  const { error: delErr } = await admin.from("media").delete().in("id", ids);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ removed: rows.length });
}
