import { NextResponse } from "next/server";
import { Readable } from "node:stream";
// Pinned to archiver v7 (CJS). v8 went pure-ESM with named exports only,
// which silently breaks this default import at runtime.
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
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "image/heic":      "heic",
  "image/heif":      "heif",
  "video/mp4":       "mp4",
  "video/quicktime": "mov",
  "video/webm":      "webm",
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Extension from an audio storage path (events/<id>/audio/<id>.webm). */
function audioExt(path: string): string {
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "webm";
}

/** RFC-4180 CSV cell: quote and escape if it contains a comma, quote, or newline. */
function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
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

  // Guest book — text notes + voice clips. The most sentimental content;
  // include it in the same archive so it has an off-platform home.
  const { data: messages } = await admin
    .from("messages")
    .select("id, body, audio_path, created_at, guests(display_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

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

      // Guest book: messages.csv + voice/ clips.
      if (messages && messages.length > 0) {
        const rows = messages.map((msg) => {
          const g = msg.guests as { display_name: string | null } | null;
          return [
            g?.display_name ?? "Guest",
            new Date(msg.created_at).toISOString(),
            msg.body ?? "",
            msg.audio_path ? `voice/${msg.id}.${audioExt(msg.audio_path)}` : "",
          ]
            .map(csvCell)
            .join(",");
        });
        const csv = ["Name,Time,Message,Voice clip", ...rows].join("\r\n");
        // UTF-8 BOM so Excel opens Chinese message bodies correctly.
        archive.append(Buffer.from("﻿" + csv, "utf8"), {
          name: "messages.csv",
        });

        for (const msg of messages) {
          if (!msg.audio_path) continue;
          const { data: blob, error: dlErr } = await admin.storage
            .from(STORAGE_BUCKET)
            .download(msg.audio_path);
          if (dlErr || !blob) continue;
          const buf = Buffer.from(await blob.arrayBuffer());
          archive.append(buf, {
            name: `voice/${msg.id}.${audioExt(msg.audio_path)}`,
            date: new Date(msg.created_at),
          });
        }
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
      "Content-Disposition": `attachment; filename="${slug}-album.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
