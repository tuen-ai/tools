"use client";

import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";

export function PrintButton({ lang }: { lang: Lang }) {
  const t = ADMIN_DICT[lang];
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-candy px-4 py-2 text-sm"
    >
      {t.printCta}
    </button>
  );
}
