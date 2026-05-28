import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import archiver from "archiver";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby allows 10s, Pro 60s, Enterprise 900s. Set to the Pro
// max — albums beyond ~500 photos may time out on this and need a
// fancier streaming-from-storage approach. Documented in CLAUDE.md.
export const maxDuration = 60;

const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id: eventId } = await params;
  try {
    await assertEventAdmin(eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("slug")
    .eq("id", eventId)
    .single();
  const slug = event?.slug ?? eventId;

  const { data: media, error } = await admin
    .from("media")
    .select("id, storage_path, mime_type, created_at")
    .eq("event_id", eventId)
    .eq("status", "visible")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!media || media.length === 0) {
    return NextResponse.json({ error: "no_photos" }, { status: 404 });
  }

  // Store, not deflate — JPEG/PNG/WebP/HEIC are already compressed, so
  // running deflate over them burns CPU for ~0 size reduction.
  const archive = archiver("zip", { zlib: { level: 0 } });

  // Pump downloads in the background; the response body stream will
  // deliver bytes as archiver produces them. We download sequentially
  // to keep memory bounded — each iteration discards the previous file
  // before fetching the next.
  (async () => {
    try {
      let i = 0;
      for (const m of media) {
        i += 1;
        const ext = EXT_FOR_MIME[m.mime_type] ?? "bin";
        const idx = String(i).padStart(4, "0");
        const entryName = `${idx}-${m.id}.${ext}`;

        const { data: blob, error: dlErr } = await admin.storage
          .from(STORAGE_BUCKET)
          .download(m.storage_path);
        if (dlErr || !blob) {
          // Skip missing files rather than abort the whole archive.
          continue;
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        archive.append(buf, {
          name: entryName,
          date: new Date(m.created_at),
        });
      }
      await archive.finalize();
    } catch {
      archive.abort();
    }
  })();

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-photos.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
