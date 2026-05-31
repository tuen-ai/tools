"use client";

import { useActionState, useRef, useEffect } from "react";

import { createTableAction, type TableActionResult } from "./actions";

const INITIAL: TableActionResult = { ok: true };

export function CreateTableForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(createTableAction, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the input on a successful create so the user can keep adding tables.
  useEffect(() => {
    if (state.ok && !state.error && !pending && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [state, pending]);

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
          placeholder="Table label (e.g. 1, A, Garden)"
          disabled={pending}
          className="flex-1 min-w-[12rem] rounded-xl border border-cream-200 bg-cream-50 px-4 py-2.5 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink-900 px-4 py-2.5 text-white text-sm font-medium hover:bg-ink-700 disabled:opacity-60 transition"
        >
          {pending ? "Adding…" : "Add table"}
        </button>
      </div>
      {state.error ? (
        <p className="mt-2 text-[11px] text-blush-600">{state.error}</p>
      ) : null}
    </form>
  );
}
