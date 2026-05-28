import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { env } from "@/lib/env";
import { PrintButton } from "./print-button";

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

export default async function QRPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const event = await getEventById(createAdminClient(), eventId);
  if (!event) notFound();

  const baseUrl = await resolveBaseUrl();
  const url = `${baseUrl}/e/${event.slug}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#2A2622", light: "#FBF8F3" },
    width: 360,
  });

  return (
    <div className="max-w-md mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/admin/${eventId}`}
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          ← Back to photos
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white rounded-3xl shadow-soft p-8 text-center print:shadow-none print:rounded-none print:p-12">
        <p className="uppercase tracking-[0.25em] text-xs text-blush-600 mb-3">
          Wedding photo sharing
        </p>
        <h1 className="font-serif text-2xl text-ink-900 mb-2">
          {event.couple_names}
        </h1>
        <p className="text-sm text-ink-500 mb-6">
          Scan the code to share your photos
        </p>
        <div
          className="mx-auto inline-block"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="font-mono text-xs text-ink-500 mt-6 break-all">{url}</p>
      </div>
    </div>
  );
}

