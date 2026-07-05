"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthResult } from "@/lib/auth/actions";
import { ADMIN_DICT, lookupAdminError } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";

const INITIAL: AuthResult = { ok: true };

export function LoginForm({ lang }: { lang: Lang }) {
  const t = ADMIN_DICT[lang];
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const message = state.error ? lookupAdminError(t, state.error) : null;

  return (
    <form
      action={formAction}
      className="frame-vintage shadow-soft p-7 space-y-4"
    >
      <label className="block">
        <span className="text-sm text-ink-700 font-medium">{t.loginEmail}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-base outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">{t.loginPassword}</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={
            mode === "signin" ? "current-password" : "new-password"
          }
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-base outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      {mode === "signup" ? (
        <label className="block">
          <span className="text-sm text-ink-700 font-medium">
            {t.loginInviteCode}
          </span>
          <span className="block text-[11px] text-ink-700">
            {t.loginInviteCodeHint}
          </span>
          <input
            name="inviteCode"
            type="text"
            required
            autoComplete="off"
            className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-base outline-none focus:border-blush-500 focus:bg-white transition font-mono"
          />
        </label>
      ) : null}

      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            state.ok
              ? "bg-sage-500/10 text-sage-700"
              : "bg-blush-400/15 text-blush-700"
          }`}
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full btn-candy px-4 py-3 text-sm"
      >
        {pending
          ? mode === "signin"
            ? t.signInPending
            : t.signUpPending
          : mode === "signin"
            ? t.signInCta
            : t.signUpCta}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="block w-full text-center text-sm text-ink-700 hover:text-ink-900"
      >
        {mode === "signin" ? t.toggleToSignUp : t.toggleToSignIn}
      </button>
    </form>
  );
}
