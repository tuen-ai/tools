"use client";

import { useActionState, useEffect, useState } from "react";

import type { Database } from "@/types/database";
import { ADMIN_DICT, lookupAdminError } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import { updateEventAction, type UpdateEventResult } from "./actions";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const INITIAL: UpdateEventResult = { ok: true };
const DEFAULT_PRIMARY = "#D9989E";

function readPrimaryColor(theme: Record<string, unknown> | null): string {
  const v = theme?.["primaryColor"];
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
    ? v
    : DEFAULT_PRIMARY;
}

export function SettingsForm({
  lang,
  event,
}: {
  lang: Lang;
  event: EventRow;
}) {
  const t = ADMIN_DICT[lang];
  const [state, action, pending] = useActionState(updateEventAction, INITIAL);
  const initialColor = readPrimaryColor(event.theme);
  const [primaryColor, setPrimaryColor] = useState(initialColor);
  const [showSaved, setShowSaved] = useState(false);
  const isDefault = primaryColor.toLowerCase() === DEFAULT_PRIMARY.toLowerCase();
  const errMessage = state.error ? lookupAdminError(t, state.error) : null;

  // Flash the "saved" toast for a few seconds rather than leaving it up
  // until the next submit.
  useEffect(() => {
    if (state.saved && !pending) {
      setShowSaved(true);
      const timer = window.setTimeout(() => setShowSaved(false), 3500);
      return () => window.clearTimeout(timer);
    }
  }, [state, pending]);

  return (
    <form
      action={action}
      className="bg-white rounded-3xl shadow-soft p-7 space-y-5"
    >
      <input type="hidden" name="eventId" value={event.id} />

      <div className="rounded-xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
        {t.slugLabel} · <span className="font-mono">/e/{event.slug}</span>
      </div>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">{t.formCoupleNames}</span>
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
        <span className="text-sm text-ink-700 font-medium">{t.formEventDate}</span>
        <input
          name="event_date"
          type="date"
          defaultValue={event.event_date ?? ""}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">{t.formWelcomeMessage}</span>
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
          {t.formMaxUploads}
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
            {t.acceptUploads}
          </span>
          <span className="block text-xs text-ink-500 mt-0.5">
            {t.acceptUploadsHint}
          </span>
        </span>
      </label>

      <div className="rounded-xl border border-cream-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-medium text-ink-900">{t.primaryColor}</span>
          {!isDefault ? (
            <button
              type="button"
              onClick={() => setPrimaryColor(DEFAULT_PRIMARY)}
              className="text-[11px] text-ink-500 hover:text-ink-900 transition"
            >
              {t.primaryColorReset}
            </button>
          ) : null}
        </div>
        <p className="text-xs text-ink-500 mb-3">{t.primaryColorHint}</p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 rounded cursor-pointer border border-cream-200"
            aria-label={t.primaryColor}
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            maxLength={7}
            className="flex-1 rounded-xl border border-cream-200 bg-cream-50 px-4 py-2 text-sm font-mono outline-none focus:border-blush-500 focus:bg-white transition"
          />
          <span
            className="inline-block rounded-full"
            style={{
              backgroundColor: primaryColor,
              width: "2.5rem",
              height: "2.5rem",
            }}
            aria-hidden
          />
        </div>
        <input
          type="hidden"
          name="primary_color"
          value={isDefault ? "" : primaryColor}
        />
      </div>

      {errMessage ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600">
          {errMessage}
        </div>
      ) : showSaved ? (
        <div className="rounded-xl bg-sage-500/15 px-4 py-3 text-sm text-sage-600 animate-[fadein_200ms_ease-out]">
          {t.saved}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-ink-900 px-4 py-3 text-white text-sm font-medium hover:bg-ink-700 disabled:opacity-60 transition"
      >
        {pending ? t.savePending : t.saveCta}
      </button>
    </form>
  );
}
