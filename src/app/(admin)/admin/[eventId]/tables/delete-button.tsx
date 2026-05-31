"use client";

import { useTransition } from "react";

import { deleteTableAction } from "./actions";

interface Props {
  eventId: string;
  tableId: string;
  label: string;
}

export function DeleteTableButton({ eventId, tableId, label }: Props) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm(`Remove table “${label}”? Existing photos keep their tag.`)) return;
    startTransition(async () => {
      await deleteTableAction({ eventId, tableId });
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="text-[11px] text-ink-500 hover:text-blush-600 disabled:opacity-60 transition"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
