import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEventBySlug } from "@/lib/db/events";
import { signThumbnailUrls } from "@/lib/db/media";
import { STORAGE_BUCKET, isVideoMime } from "@/lib/upload/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Slideshow URL is reachable by anyone who knows the event slug. The
// venue projector / iPad opens it and forgets it. We do NOT mint signed
// URLs for individual media via the admin endpoint here — instead the
// route looks up the event by slug + delivers signed slide URLs in one
// shot, mirroring how /api/upload/sign works (slug = access token).
//
// PRIVACY TRADE-OFF (intentional): this endpoint uses the service-role
// client and therefore bypasses the "Gallery is private to the couple"
// RLS invariant documented in CLAUDE.md. Anyone holding the (publicly
// printed/forwarded) slug can poll it with ?since= to enumerate 30-min
// signed download URLs for every visible photo/video. This is a
// deliberate Phase 7 design choice for a frictionless venue projector;
// if stronger privacy is needed, gate behind an admin-rotatable
// events.show_token column instead of the slug. See CLAUDE.md.

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  since: z.string().optional(),
});

interface RouteCtx {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteCtx) {
  const { slug } = await params;
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? "200",
    since: url.searchParams.get("since") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const admin = createAdminClient();
  const event = await getEventBySlug(admin, slug);
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  // Photos and videos, visible only. Sort ascending so the slideshow
  // plays chronologically — toasts and Ken Burns will surface fresh ones.
  let q = admin
    .from("media")
    .select("id, storage_path, mime_type, created_at, guest_id")
    .eq("event_id", event.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(parsed.data.limit);

  // gte (not gt) so a row sharing the cursor's exact timestamp is not
  // skipped; the client dedupes the re-returned boundary row by id.
  if (parsed.data.since) q = q.gte("created_at", parsed.data.since);

  const { data: media, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Separate images (signed transform for 1600px wide) from videos (signed
  // original URL, the slideshow client uses a <video> element).
  const images = (media ?? []).filter((m) => !isVideoMime(m.mime_type));
  const videos = (media ?? []).filter((m) => isVideoMime(m.mime_type));

  const [imageSigned, videoSigned] = await Promise.all([
    signThumbnailUrls(admin, images, {
      width: 1600,
      height: 1600,
      quality: 80,
      expiresInSec: 1800,
    }),
    Promise.all(
      videos.map(async (m) => {
        const { data, error } = await admin.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(m.storage_path, 1800);
        if (error || !data) return null;
        return { id: m.id, url: data.signedUrl };
      }),
    ),
  ]);

  const videoMap = new Map(
    videoSigned.filter((x): x is { id: string; url: string } => !!x).map((s) => [s.id, s.url]),
  );
  const imageMap = new Map(imageSigned.map((s) => [s.id, s.url]));

  // Build slides preserving chronological order, attaching signed URLs.
  const slides = (media ?? [])
    .map((m) => {
      const url = isVideoMime(m.mime_type)
        ? videoMap.get(m.id)
        : imageMap.get(m.id);
      if (!url) return null;
      return {
        id: m.id,
        url,
        kind: isVideoMime(m.mime_type) ? "video" : "image",
        createdAt: m.created_at,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return NextResponse.json({
    eventId: event.id,
    coupleNames: event.couple_names,
    slides,
  });
}
