"use client";

import { useActionState } from "react";
import { createEventAction, type CreateEventResult } from "./actions";

const INITIAL: CreateEventResult = { ok: true };

export function NewEventForm() {
  const [state, action, pending] = useActionState(createEventAction, INITIAL);

  return (
    <form
      action={action}
      className="bg-white rounded-3xl shadow-soft p-7 space-y-4"
    >
      <Field name="couple_names" label="Couple’s names" required>
        <input
          id="couple_names"
          name="couple_names"
          type="text"
          required
          maxLength={120}
          placeholder="Sarah & Tom"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </Field>

      <Field
        name="slug"
        label="URL slug"
        required
        hint="Used in the QR link, e.g. /e/sarah-and-tom-2026"
      >
        <input
          id="slug"
          name="slug"
          type="text"
          required
          pattern="^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$"
          placeholder="sarah-and-tom-2026"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition font-mono text-sm"
        />
      </Field>

      <Field name="event_date" label="Event date">
        <input
          id="event_date"
          name="event_date"
          type="date"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </Field>

      <Field name="welcome_message" label="Welcome message">
        <textarea
          id="welcome_message"
          name="welcome_message"
          maxLength={500}
          rows={3}
          placeholder="Share your favourite photos with us!"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition resize-none"
        />
      </Field>

      {state.error ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-ink-900 px-4 py-3 text-white text-sm font-medium hover:bg-ink-700 disabled:opacity-60 transition"
      >
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  required,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={name} className="block">
      <span className="text-sm text-ink-700 font-medium">
        {label}
        {required ? " *" : null}
      </span>
      {hint ? <span className="block text-[11px] text-ink-500">{hint}</span> : null}
      {children}
    </label>
  );
}
