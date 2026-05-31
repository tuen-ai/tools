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

  const inactiveClass =
    tone === "dark"
      ? "text-white/50 hover:text-white"
      : tone === "muted"
        ? "text-ink-500/70 hover:text-ink-900"
        : "text-ink-500 hover:text-ink-900";
  const activeClass =
    tone === "dark"
      ? "text-white font-semibold"
      : "text-ink-900 font-semibold";

  return (
    <div
      className="inline-flex items-center gap-3 text-[11px]"
      role="group"
      aria-label="Language"
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => pick(code)}
          disabled={pending}
          className={`transition ${
            code === current ? activeClass : inactiveClass
          } disabled:opacity-60`}
        >
          {LANGUAGE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
