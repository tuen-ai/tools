"use client";

import { useActionState } from "react";
import { createEventAction, type CreateEventResult } from "./actions";
import { ADMIN_DICT, lookupAdminError } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";

const INITIAL: CreateEventResult = { ok: true };

export function NewEventForm({ lang }: { lang: Lang }) {
  const t = ADMIN_DICT[lang];
  const [state, action, pending] = useActionState(createEventAction, INITIAL);
  const message = state.error ? lookupAdminError(t, state.error) : null;

  return (
    <form
      action={action}
      className="bg-white rounded-3xl shadow-soft p-7 space-y-4"
    >
      <Field name="couple_names" label={t.formCoupleNames} required>
        <input
          id="couple_names"
          name="couple_names"
          type="text"
          required
          maxLength={120}
          placeholder={t.formCoupleNamesPlaceholder}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </Field>

      <Field
        name="slug"
        label={t.formUrlSlug}
        required
        hint={t.formUrlSlugHint}
      >
        <input
          id="slug"
          name="slug"
          type="text"
          required
          pattern="^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$"
          placeholder={t.formUrlSlugPlaceholder}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition font-mono text-sm"
        />
      </Field>

      <Field name="event_date" label={t.formEventDate}>
        <input
          id="event_date"
          name="event_date"
          type="date"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </Field>

      <Field name="welcome_message" label={t.formWelcomeMessage}>
        <textarea
          id="welcome_message"
          name="welcome_message"
          maxLength={500}
          rows={3}
          placeholder={t.formWelcomePlaceholder}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition resize-none"
        />
      </Field>

      {message ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-700">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full btn-candy px-4 py-3 text-sm"
      >
        {pending ? t.createEventPending : t.createEventCta}
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
      {hint ? <span className="block text-[11px] text-ink-700">{hint}</span> : null}
      {children}
    </label>
  );
}
