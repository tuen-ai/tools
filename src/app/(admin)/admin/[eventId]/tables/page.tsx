import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { listTables } from "@/lib/db/tables";
import { env } from "@/lib/env";
import { CreateTableForm } from "./create-form";
import { DeleteTableButton } from "./delete-button";

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

export default async function TablesPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const admin = createAdminClient();
  const event = await getEventById(admin, eventId);
  if (!event) notFound();

  const tables = await listTables(admin, eventId);
  const baseUrl = await resolveBaseUrl();

  const qrs = await Promise.all(
    tables.map(async (t) => ({
      table: t,
      url: `${baseUrl}/e/${event.slug}?table=${encodeURIComponent(t.label)}`,
      svg: await QRCode.toString(
        `${baseUrl}/e/${event.slug}?table=${encodeURIComponent(t.label)}`,
        {
          type: "svg",
          margin: 1,
          color: { dark: "#2A2622", light: "#FBF8F3" },
          width: 200,
        },
      ),
    })),
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/admin/${eventId}`}
        className="inline-block text-sm text-ink-500 hover:text-ink-900 mb-4 print:hidden"
      >
        ← Back to photos
      </Link>
      <header className="mb-6 print:hidden">
        <h1 className="font-serif text-2xl text-ink-900">Per-table QR codes</h1>
        <p className="text-sm text-ink-500 mt-1">
          Print one QR per table. Photos uploaded from each table get
          tagged automatically — you can filter the gallery by table later.
        </p>
      </header>

      <div className="print:hidden">
        <CreateTableForm eventId={eventId} />
      </div>

      {tables.length === 0 ? (
        <div className="bg-white rounded-3xl border border-cream-200 p-10 text-center mt-6 print:hidden">
          <div className="text-4xl mb-3" aria-hidden>🪑</div>
          <p className="text-ink-500 text-sm">
            No tables yet. Add table labels (e.g. <span className="font-mono">1</span>, <span className="font-mono">2</span>, <span className="font-mono">A</span>, <span className="font-mono">Garden</span>) and a printable QR will appear for each.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 print:grid-cols-3">
          {qrs.map(({ table, url, svg }) => (
            <div
              key={table.id}
              className="bg-white rounded-2xl border border-cream-200 p-4 text-center break-inside-avoid print:border-ink-500"
            >
              <p className="uppercase tracking-[0.2em] text-[10px] text-blush-600 mb-1">
                Table
              </p>
              <h2 className="font-serif text-2xl text-ink-900 mb-3 break-words">
                {table.label}
              </h2>
              <div
                className="mx-auto inline-block mb-3"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="font-mono text-[9px] text-ink-500 break-all">{url}</p>
              <div className="mt-3 print:hidden">
                <DeleteTableButton eventId={eventId} tableId={table.id} label={table.label} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
