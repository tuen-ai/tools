"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthResult } from "@/lib/auth/actions";

const INITIAL: AuthResult = { ok: true };

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form
      action={formAction}
      className="bg-white rounded-3xl shadow-soft p-7 space-y-4"
    >
      <label className="block">
        <span className="text-sm text-ink-700 font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink-700 font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={
            mode === "signin" ? "current-password" : "new-password"
          }
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      {mode === "signup" ? (
        <label className="block">
          <span className="text-sm text-ink-700 font-medium">
            Invite code
          </span>
          <span className="block text-[11px] text-ink-500">
            Get this from the couple or an existing admin.
          </span>
          <input
            name="inviteCode"
            type="text"
            required
            autoComplete="off"
            className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition font-mono"
          />
        </label>
      ) : null}

      {state.error ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            state.ok
              ? "bg-sage-500/10 text-sage-600"
              : "bg-blush-400/15 text-blush-600"
          }`}
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-ink-900 px-4 py-3 text-white text-sm font-medium hover:bg-ink-700 disabled:opacity-60 transition"
      >
        {pending
          ? mode === "signin"
            ? "Signing in…"
            : "Creating account…"
          : mode === "signin"
            ? "Sign in"
            : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="block w-full text-center text-sm text-ink-500 hover:text-ink-700"
      >
        {mode === "signin"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
