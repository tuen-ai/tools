"use client";

import { useState } from "react";

import { DICT, type Lang } from "@/lib/i18n";
import { LanguageSwitch } from "@/lib/i18n/language-switch";
import { UploadClient } from "./upload-client";
import { ClosedScreen } from "./closed";

interface Props {
  initialLang: Lang;
  eventSlug: string;
  coupleNames: string;
  welcomeMessage: string | null;
  coverUrl: string | null;
  primaryColor: string | null;
  tableLabel: string | null;
  maxPerGuest: number;
  uploadEnabled: boolean;
  challenges: { id: string; prompt: string }[];
}

/**
 * Client shell for the whole guest surface. Holds the language as CLIENT
 * state so switching en↔中 is instant — no server round-trip — while the
 * cookie + URL are still updated (see LanguageSwitch onSelect) so a
 * refreshed or shared link keeps the choice.
 */
export function GuestExperience({
  initialLang,
  eventSlug,
  coupleNames,
  welcomeMessage,
  coverUrl,
  primaryColor,
  tableLabel,
  maxPerGuest,
  uploadEnabled,
  challenges,
}: Props) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = DICT[lang];

  return (
    <div className="relative z-10 w-full max-w-md animate-[fadeup_500ms_ease-out]">
      <div className="flex justify-end mb-3">
        <LanguageSwitch current={lang} onSelect={setLang} />
      </div>

      {coverUrl ? (
        <div className="mb-6 overflow-hidden rounded-3xl shadow-soft animate-[fadeup_700ms_ease-out]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" className="w-full h-56 object-cover" />
        </div>
      ) : null}

      <header className="text-center mb-8">
        {tableLabel ? (
          <p
            className={`inline-block text-[11px] font-semibold tracking-widest px-3 py-1.5 rounded-md mb-3 rotate-2 border-2 border-dashed ${
              primaryColor
                ? "text-white border-white/50"
                : "text-blush-700 border-blush-700"
            }`}
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          >
            {t.tableBadge(tableLabel)}
          </p>
        ) : null}
        <p
          className={`uppercase tracking-[0.3em] text-xs font-semibold mb-3 ${
            primaryColor ? "" : "text-sage-700"
          }`}
          style={primaryColor ? { color: primaryColor } : undefined}
        >
          {t.eyebrow}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-ink-900 leading-tight">
          {coupleNames}
        </h1>
        {welcomeMessage ? (
          <p className="mt-4 text-ink-700 text-[15px] leading-relaxed">
            {welcomeMessage}
          </p>
        ) : null}
      </header>

      {uploadEnabled ? (
        <UploadClient
          lang={lang}
          eventSlug={eventSlug}
          maxPerGuest={maxPerGuest}
          primaryColor={primaryColor}
          tableLabel={tableLabel}
          challenges={challenges}
        />
      ) : (
        <ClosedScreen lang={lang} />
      )}
    </div>
  );
}
