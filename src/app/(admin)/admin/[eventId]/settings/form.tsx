"use client";

import { useActionState } from "react";

import type { Database } from "@/types/database";
import { updateEventAction, type UpdateEventResult } from "./actions";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const INITIAL: UpdateEventResult = { ok: true };

export function SettingsForm({ event }: { event: EventRow }) {
  const [state, action, pending] = useActionState(updateEventAction, INITIAL);

  return (
    <form
      action={action}
      className="bg-white rounded-3xl shadow-soft p-7 space-y-5"
    >
      <input type="hidden" name="eventId" value={event.id} />

      <div className="rounded-xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
        Slug · <span className="font-mono">/e/{event.slug}</span>
      </div>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">Couple’s names</span>
        <input
          name="couple_names"
          type="text"
          required
          maxLength={120}
          defaultValue={event.couple_names}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">Event date</span>
        <input
          name="event_date"
          type="date"
          defaultValue={event.event_date ?? ""}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">Welcome message</span>
        <textarea
          name="welcome_message"
          maxLength={500}
          rows={3}
          defaultValue={event.welcome_message ?? ""}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition resize-none"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">
          Max uploads per guest
        </span>
        <input
          name="max_uploads_per_guest"
          type="number"
          min={1}
          max={500}
          defaultValue={event.max_uploads_per_guest}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-cream-200 p-4 cursor-pointer hover:border-blush-400 transition">
        <input
          name="upload_enabled"
          type="checkbox"
          defaultChecked={event.upload_enabled}
          className="mt-0.5 h-4 w-4 accent-blush-500"
        />
        <span>
          <span className="block text-sm font-medium text-ink-900">
            Accept new uploads
          </span>
          <span className="block text-xs text-ink-500 mt-0.5">
            Turn off when you’ve collected enough photos. Existing photos stay
            visible to you.
          </span>
        </span>
      </label>

      {state.error ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600">
          {state.error}
        </div>
      ) : state.saved && !pending ? (
        <div className="rounded-xl bg-sage-500/15 px-4 py-3 text-sm text-sage-600">
          Saved.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-ink-900 px-4 py-3 text-white text-sm font-medium hover:bg-ink-700 disabled:opacity-60 transition"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

