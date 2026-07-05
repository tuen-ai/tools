"use client";

import { useActionState, useRef, useEffect } from "react";

import { ADMIN_DICT, lookupAdminError } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import { createChallengeAction, type ChallengeActionResult } from "./actions";

const INITIAL: ChallengeActionResult = { ok: true };

export function CreateChallengeForm({
  lang,
  eventId,
  existingPrompts,
}: {
  lang: Lang;
  eventId: string;
  existingPrompts: string[];
}) {
  const t = ADMIN_DICT[lang];
  const [state, action, pending] = useActionState(createChallengeAction, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !state.error && !pending && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [state, pending]);

  const errMessage = state.error ? lookupAdminError(t, state.error) : null;
  const existing = new Set(existingPrompts);
  const suggestions = t.challengeSuggestions.filter((s) => !existing.has(s));

  return (
    <form ref={formRef} action={action} className="bg-white rounded-3xl shadow-soft p-5">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          name="prompt"
          type="text"
          required
          maxLength={120}
          placeholder={t.challengePromptPlaceholder}
          disabled={pending}
          className="flex-1 min-w-[12rem] rounded-xl border border-cream-200 bg-cream-50 px-4 py-2.5 text-base outline-none focus:border-blush-500 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-candy px-4 py-2.5 text-sm"
        >
          {pending ? t.addChallengePending : t.addChallengeCta}
        </button>
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-700">
            {t.challengeSuggestionsLabel}
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => {
                // Fill and submit in one tap — the suggestion IS the prompt.
                if (inputRef.current) {
                  inputRef.current.value = s;
                  formRef.current?.requestSubmit();
                }
              }}
              className="rounded-full border border-cream-200 bg-cream-50 px-2.5 py-1 text-[11px] text-ink-700 hover:border-blush-400 transition disabled:opacity-60"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
      {errMessage ? (
        <p className="mt-2 text-[11px] text-blush-700">{errMessage}</p>
      ) : null}
    </form>
  );
}
