"use client";

import { useTransition } from "react";

import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import { deleteTableAction } from "./actions";

interface Props {
  lang: Lang;
  eventId: string;
  tableId: string;
  label: string;
}

export function DeleteTableButton({ lang, eventId, tableId, label }: Props) {
  const t = ADMIN_DICT[lang];
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm(t.removeTableConfirm(label))) return;
    startTransition(async () => {
      await deleteTableAction({ eventId, tableId });
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="text-[11px] text-ink-700 hover:text-blush-700 disabled:opacity-60 transition"
    >
      {pending ? t.removeTablePending : t.removeTable}
    </button>
  );
}
