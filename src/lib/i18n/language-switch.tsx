"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  LANGUAGE_LABELS,
  LANGUAGES,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  type Lang,
} from "./index";

interface Props {
  current: Lang;
  /**
   * Optional. If omitted, the switch navigates to the current pathname,
   * preserving any extra query params. Passing `basePath` lets a caller
   * pin the link to a specific route (e.g. always /e/<slug>).
   */
  basePath?: string;
  /** Tone variant. "dark" for use over dark backgrounds (slideshow). */
  tone?: "default" | "muted" | "dark";
}

/** Writes the language preference cookie, then navigates to ?lang=<code>. */
function setLangCookie(code: Lang) {
  document.cookie = `${LANG_COOKIE}=${code}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
}

export function LanguageSwitch({ current, basePath, tone = "default" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function pick(code: Lang) {
    if (code === current || pending) return;
    setLangCookie(code);

    const target = basePath ?? pathname ?? "/";
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", code);

    startTransition(() => {
      router.push(`${target}?${params.toString()}`);
      router.refresh();
    });
  }

  // Segmented pill with real tap targets (≥40px) — the previous bare 11px
  // text buttons were hard to find and hard to hit on a phone.
  const container =
    tone === "dark"
      ? "bg-white/10 border border-white/20"
      : "bg-cream-100 border border-cream-200";
  const activeClass =
    tone === "dark"
      ? "bg-white text-ink-900 font-semibold"
      : "bg-white text-ink-900 font-semibold shadow-sm";
  const inactiveClass =
    tone === "dark"
      ? "text-white/70 hover:text-white"
      : "text-ink-700 hover:text-ink-900";

  return (
    <div
      className={`inline-flex items-center rounded-full p-0.5 ${container}`}
      role="group"
      aria-label={current === "zh-Hant" ? "語言" : "Language"}
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => pick(code)}
          disabled={pending}
          aria-pressed={code === current}
          className={`rounded-full px-3.5 py-2 text-xs transition disabled:opacity-60 ${
            code === current ? activeClass : inactiveClass
          }`}
        >
          {LANGUAGE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
