import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { env } from "@/lib/env";
import { QR_DARK, QR_LIGHT } from "@/lib/theme";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { PrintButton } from "./print-button";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ variant?: string }>;
}

async function resolveBaseUrl(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function QRPage({ params, searchParams }: Props) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);
  await requireEventAdmin(eventId);

  const [event, lang] = await Promise.all([
    getEventById(createAdminClient(), eventId),
    resolveLangServer(),
  ]);
  if (!event) notFound();
  const t = ADMIN_DICT[lang];

  const variant = sp.variant === "thankyou" ? "thankyou" : "sign";
  const baseUrl = await resolveBaseUrl();
  const url = `${baseUrl}/e/${event.slug}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: QR_DARK, light: QR_LIGHT },
    width: 360,
  });

  return (
    <div className="max-w-md mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/admin/${eventId}`}
          className="text-sm text-ink-700 hover:text-ink-900"
        >
          {t.backToPhotos}
        </Link>
        <PrintButton lang={lang} />
      </div>

      {/* Variant tabs — server-rendered links, no client state. */}
      <div className="mb-4 inline-flex rounded-lg bg-cream-100 p-0.5 text-xs print:hidden">
        <Link
          href={`/admin/${eventId}/qr`}
          className={`px-3 py-1.5 rounded-md transition ${
            variant === "sign"
              ? "bg-white shadow-sm text-ink-900"
              : "text-ink-700"
          }`}
        >
          {t.qrTabSign}
        </Link>
        <Link
          href={`/admin/${eventId}/qr?variant=thankyou`}
          className={`px-3 py-1.5 rounded-md transition ${
            variant === "thankyou"
              ? "bg-white shadow-sm text-ink-900"
              : "text-ink-700"
          }`}
        >
          {t.qrTabThankYou}
        </Link>
      </div>

      {variant === "sign" ? (
        <div className="bg-white rounded-3xl shadow-soft p-8 text-center print:shadow-none print:rounded-none print:p-12">
          <p className="uppercase tracking-[0.25em] text-xs text-blush-700 mb-3">
            {t.brand}
          </p>
          <h1 className="font-serif text-2xl text-ink-900 mb-2">
            {event.couple_names}
          </h1>
          <p className="text-sm text-ink-700 mb-6">{t.qrScanInstruction}</p>
          <div
            className="mx-auto inline-block"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="font-mono text-xs text-ink-700 mt-6 break-all">{url}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-700 mb-3 print:hidden">
            {t.qrThankYouHint}
          </p>
          {/* 4-up A4: dashed borders double as cut lines. The same stable
              event URL keeps working after the wedding, so guests who never
              scanned at the venue can upload later from the card. */}
          <div className="grid grid-cols-2 gap-3 print:gap-0 print:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl print:rounded-none border border-dashed border-cream-200 print:border-ink-500 p-5 text-center break-inside-avoid"
              >
                <h2 className="font-serif text-base text-ink-900 mb-1">
                  {event.couple_names}
                </h2>
                <p className="text-[10px] text-ink-700 leading-snug mb-3">
                  {t.qrThankYouMessage}
                </p>
                <div
                  className="mx-auto inline-block [&_svg]:h-auto [&_svg]:w-24"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <p className="font-mono text-[8px] text-ink-700 mt-2 break-all">
                  {url}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
