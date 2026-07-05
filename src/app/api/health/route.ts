import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for an external uptime monitor (UptimeRobot / Better
 * Stack / Vercel checks). Verifies the two dependencies a guest upload
 * actually needs — Postgres and Storage — and returns 503 when either
 * fails so the monitor alerts.
 *
 * Deliberately unauthenticated and information-free (booleans only):
 * knowing "the DB is up" reveals nothing about any event. HEAD-style
 * queries keep it cheap enough to ping every minute.
 */
export async function GET() {
  const admin = createAdminClient();

  const [db, storage] = await Promise.all([
    (async () => {
      try {
        const { error } = await admin
          .from("events")
          .select("id", { count: "exact", head: true })
          .limit(1);
        return !error;
      } catch {
        return false;
      }
    })(),
    (async () => {
      try {
        const { error } = await admin.storage
          .from(STORAGE_BUCKET)
          .list("", { limit: 1 });
        return !error;
      } catch {
        return false;
      }
    })(),
  ]);

  const ok = db && storage;
  return NextResponse.json(
    {
      ok,
      db,
      storage,
      // Which build is live — first 7 chars of the deployed commit.
      rev: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
      time: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
