"use client";

import { useActionState, useRef, useEffect } from "react";

import { ADMIN_DICT, lookupAdminError } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import { createTableAction, type TableActionResult } from "./actions";

const INITIAL: TableActionResult = { ok: true };

export function CreateTableForm({
  lang,
  eventId,
}: {
  lang: Lang;
  eventId: string;
}) {
  const t = ADMIN_DICT[lang];
  const [state, action, pending] = useActionState(createTableAction, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok && !state.error && !pending && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [state, pending]);

  const errMessage = state.error ? lookupAdminError(t, state.error) : null;

  return (
    <form action={action} className="bg-white rounded-3xl shadow-soft p-5">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          name="label"
          type="text"
          required
          maxLength={64}
          placeholder={t.tableLabelPlaceholder}
          disabled={pending}
          className="flex-1 min-w-[12rem] rounded-xl border border-cream-200 bg-cream-50 px-4 py-2.5 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-candy px-4 py-2.5 text-sm"
        >
          {pending ? t.addTablePending : t.addTableCta}
        </button>
      </div>
      {errMessage ? (
        <p className="mt-2 text-[11px] text-blush-700">{errMessage}</p>
      ) : null}
    </form>
  );
}
