import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { signOriginalUrl } from "@/lib/db/media";
import { env } from "@/lib/env";
import { DEFAULT_PRIMARY_COLOR, QR_DARK, QR_LIGHT } from "@/lib/theme";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { PosterClient } from "./poster-client";

interface Props {
  params: Promise<{ eventId: string }>;
}

async function resolveBaseUrl(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function readPrimaryColor(theme: Record<string, unknown> | null): string {
  const v = theme?.["primaryColor"];
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
    ? v
    : DEFAULT_PRIMARY_COLOR;
}

export default async function PosterPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const admin = createAdminClient();
  const [event, lang] = await Promise.all([
    getEventById(admin, eventId),
    resolveLangServer(),
  ]);
  if (!event) notFound();
  const t = ADMIN_DICT[lang];

  const baseUrl = await resolveBaseUrl();
  const url = `${baseUrl}/e/${event.slug}`;

  // Pre-render a chunky QR SVG with the chosen primary color subtly
  // baked into the alignment patterns.
  const primaryColor = readPrimaryColor(event.theme);
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: QR_DARK, light: QR_LIGHT },
    width: 480,
  });

  let coverUrl: string | null = null;
  if (event.cover_image_path) {
    try {
      coverUrl = await signOriginalUrl(admin, event.cover_image_path, 1800);
    } catch {
      // ignore — render the no-cover variant
    }
  }

  return (
    <div className="max-w-4xl mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/admin/${eventId}`}
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          {t.backToPhotos}
        </Link>
      </div>
      <header className="mb-6 print:hidden">
        <h1 className="font-serif text-2xl text-ink-900">{t.posterHeading}</h1>
        <p className="text-sm text-ink-500 mt-1">{t.posterSubtitle}</p>
      </header>

      <PosterClient
        lang={lang}
        coupleNames={event.couple_names}
        eventDate={event.event_date}
        welcomeMessage={event.welcome_message}
        scanInstruction={t.posterScanInstruction}
        url={url}
        qrSvg={qrSvg}
        coverUrl={coverUrl}
        primaryColor={primaryColor}
      />

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #FFF6F2 !important; }
        }
      `}</style>
    </div>
  );
}
