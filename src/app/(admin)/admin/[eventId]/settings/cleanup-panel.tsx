"use client";

import { useState, useTransition } from "react";

import { ADMIN_DICT, lookupAdminError } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import {
  cleanupStorageAction,
  type CleanupResult,
} from "./cleanup-action";

export function CleanupPanel({
  lang,
  eventId,
}: {
  lang: Lang;
  eventId: string;
}) {
  const t = ADMIN_DICT[lang];
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CleanupResult | null>(null);

  function run() {
    if (!window.confirm(t.cleanupConfirm)) return;
    startTransition(async () => {
      const r = await cleanupStorageAction({ eventId });
      setResult(r);
    });
  }

  const errMessage =
    result && !result.ok && result.error
      ? lookupAdminError(t, result.error)
      : null;

  return (
    <div className="bg-white rounded-3xl shadow-soft p-7 mt-6 space-y-3">
      <div>
        <h2 className="font-serif text-lg text-ink-900">{t.cleanupHeading}</h2>
        <p className="text-sm text-ink-700 mt-1">{t.cleanupHint}</p>
      </div>

      {result?.ok ? (
        <div className="rounded-xl bg-sage-500/15 px-4 py-3 text-sm text-sage-700">
          {t.cleanupResult(
            result.orphansDeleted ?? 0,
            result.staleDeleted ?? 0,
          )}
        </div>
      ) : null}
      {errMessage ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-700">
          {errMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="w-full rounded-xl border border-blush-400 text-blush-700 px-4 py-3 text-sm font-medium hover:bg-blush-400/10 disabled:opacity-60 transition"
      >
        {pending ? t.cleanupPending : t.cleanupCta}
      </button>
    </div>
  );
}
