"use client";

import { useState } from "react";

import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";

type Template = "minimal" | "photo" | "ornate";

interface Props {
  lang: Lang;
  coupleNames: string;
  eventDate: string | null;
  welcomeMessage: string | null;
  scanInstruction: string;
  url: string;
  qrSvg: string;
  coverUrl: string | null;
  primaryColor: string;
}

export function PosterClient(props: Props) {
  const t = ADMIN_DICT[props.lang];
  const [template, setTemplate] = useState<Template>(
    props.coverUrl ? "photo" : "minimal",
  );

  const templates: { key: Template; label: string; disabled?: boolean }[] = [
    { key: "minimal", label: t.posterTemplateMinimal },
    { key: "photo", label: t.posterTemplatePhoto, disabled: !props.coverUrl },
    { key: "ornate", label: t.posterTemplateOrnate },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <span className="text-sm text-ink-700">{t.posterPickTemplate}</span>
        <div className="flex flex-wrap gap-2">
          {templates.map(({ key, label, disabled }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTemplate(key)}
              disabled={disabled}
              className={`rounded-xl px-4 py-2 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                template === key
                  ? "bg-ink-900 text-white"
                  : "border border-cream-200 bg-white text-ink-700 hover:border-blush-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto btn-candy px-4 py-2 text-sm"
        >
          {t.printCta}
        </button>
      </div>

      {/* A4 preview frame (portrait, ~210mm × 297mm). */}
      <div
        className="mx-auto bg-cream-50 rounded-xl overflow-hidden shadow-soft print:shadow-none print:rounded-none"
        style={{ width: "210mm", maxWidth: "100%", aspectRatio: "210 / 297" }}
      >
        {template === "minimal" ? (
          <MinimalTemplate {...props} t={t} />
        ) : template === "photo" ? (
          <PhotoTemplate {...props} t={t} />
        ) : (
          <OrnateTemplate {...props} t={t} />
        )}
      </div>
    </>
  );
}

// ─── Template renderers ────────────────────────────────────────────────

interface TemplateProps extends Props {
  t: typeof ADMIN_DICT[Lang];
}

function MinimalTemplate(p: TemplateProps) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-between text-center px-12 py-16">
      <header>
        <p
          className="uppercase tracking-[0.4em] text-[10px] mb-3"
          style={{ color: p.primaryColor }}
        >
          {p.t.brand}
        </p>
        <h1 className="font-serif text-5xl text-ink-900 leading-tight">
          {p.coupleNames}
        </h1>
        {p.eventDate ? (
          <p className="mt-3 text-ink-500 text-sm">{p.eventDate}</p>
        ) : null}
      </header>

      <div className="flex flex-col items-center">
        <div
          className="bg-white rounded-3xl p-6 shadow-soft"
           
          dangerouslySetInnerHTML={{ __html: p.qrSvg }}
        />
        <p className="mt-6 text-ink-700 text-sm">{p.scanInstruction}</p>
        <p className="mt-2 font-mono text-[10px] text-ink-500 break-all max-w-xs">
          {p.url}
        </p>
      </div>

      <Ornament color={p.primaryColor} />
    </div>
  );
}

function PhotoTemplate(p: TemplateProps) {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Cover photo hero (top 55%) */}
      <div className="relative" style={{ height: "55%" }}>
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-cream-50" />
      </div>

      {/* QR card section */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-10 -mt-12 relative z-10">
        <div className="bg-white rounded-3xl shadow-soft p-7 max-w-md w-full">
          <p
            className="uppercase tracking-[0.3em] text-[9px] mb-2"
            style={{ color: p.primaryColor }}
          >
            {p.t.brand}
          </p>
          <h1 className="font-serif text-3xl text-ink-900 mb-1">
            {p.coupleNames}
          </h1>
          {p.eventDate ? (
            <p className="text-ink-500 text-xs mb-4">{p.eventDate}</p>
          ) : null}
          <div
            className="mx-auto inline-block"
            style={{ width: "60mm" }}
             
            dangerouslySetInnerHTML={{ __html: p.qrSvg }}
          />
          <p className="mt-4 text-ink-700 text-sm">{p.scanInstruction}</p>
          <p className="mt-1 font-mono text-[9px] text-ink-500 break-all">
            {p.url}
          </p>
        </div>
      </div>
    </div>
  );
}

function OrnateTemplate(p: TemplateProps) {
  const tint = `${p.primaryColor}26`; // ~15% alpha
  return (
    <div className="h-full w-full relative flex flex-col items-center justify-center text-center px-16 py-20">
      {/* Decorative inner border */}
      <div
        className="absolute inset-8 rounded-[2.5rem] border-2"
        style={{ borderColor: p.primaryColor, opacity: 0.5 }}
      />
      <div
        className="absolute inset-10 rounded-[2.25rem] border"
        style={{ borderColor: p.primaryColor, opacity: 0.3 }}
      />

      {/* Corner flourishes */}
      <Flourish className="absolute top-8 left-8" color={p.primaryColor} />
      <Flourish
        className="absolute top-8 right-8 -scale-x-100"
        color={p.primaryColor}
      />
      <Flourish
        className="absolute bottom-8 left-8 -scale-y-100"
        color={p.primaryColor}
      />
      <Flourish
        className="absolute bottom-8 right-8 -scale-x-100 -scale-y-100"
        color={p.primaryColor}
      />

      <header className="relative z-10 mb-8">
        <Divider color={p.primaryColor} />
        <p
          className="uppercase tracking-[0.5em] text-[10px] mt-4 mb-3"
          style={{ color: p.primaryColor }}
        >
          {p.t.brand}
        </p>
        <h1 className="font-serif text-5xl text-ink-900 italic leading-tight">
          {p.coupleNames}
        </h1>
        {p.eventDate ? (
          <p className="mt-3 text-ink-500 text-sm tracking-widest">
            {p.eventDate}
          </p>
        ) : null}
        {p.welcomeMessage ? (
          <p className="mt-4 text-ink-700 text-sm italic max-w-sm mx-auto">
            “{p.welcomeMessage}”
          </p>
        ) : null}
        <div className="mt-5"><Divider color={p.primaryColor} /></div>
      </header>

      <div className="relative z-10 flex flex-col items-center">
        <div
          className="rounded-3xl p-6 shadow-soft"
          style={{ background: "#FFFFFF", border: `1px solid ${tint}` }}

          dangerouslySetInnerHTML={{ __html: p.qrSvg }}
        />
        <p
          className="mt-5 text-sm tracking-wider"
          style={{ color: p.primaryColor }}
        >
          {p.scanInstruction}
        </p>
        <p className="mt-1 font-mono text-[9px] text-ink-500 break-all max-w-xs">
          {p.url}
        </p>
      </div>
    </div>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 200 12"
      width="200"
      height="12"
      className="mx-auto"
      aria-hidden
    >
      <line x1="20" y1="6" x2="85" y2="6" stroke={color} strokeWidth="0.8" />
      <line x1="115" y1="6" x2="180" y2="6" stroke={color} strokeWidth="0.8" />
      <circle cx="100" cy="6" r="3" fill={color} />
      <circle cx="100" cy="6" r="5" fill="none" stroke={color} strokeWidth="0.6" />
    </svg>
  );
}

function Ornament({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 40" width="120" height="48" aria-hidden>
      <path
        d="M 10 20 Q 30 5, 50 20 T 90 20"
        stroke={color}
        strokeWidth="1"
        fill="none"
      />
      <circle cx="50" cy="20" r="3" fill={color} />
    </svg>
  );
}

function Flourish({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 60 60"
      width="80"
      height="80"
      className={className}
      aria-hidden
    >
      <path
        d="M 5 30 Q 15 5, 30 5 M 5 30 Q 5 15, 20 10 M 5 30 Q 12 22, 22 18"
        stroke={color}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="30" cy="5" r="2" fill={color} />
      <circle cx="20" cy="10" r="1.5" fill={color} />
      <circle cx="22" cy="18" r="1" fill={color} />
    </svg>
  );
}
