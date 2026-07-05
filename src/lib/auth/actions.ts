"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const SignUpSchema = CredentialsSchema.extend({
  inviteCode: z.string().min(1).max(128),
});

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export async function signInAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "err_invalid_credentials" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: mapSupabaseAuthError(error.message) };

  redirect("/admin");
}

export async function signUpAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  // Gate 1: signups are closed unless an invite code is configured.
  const expected = serverEnv.ADMIN_SIGNUP_INVITE_CODE;
  if (!expected) {
    return { ok: false, error: "err_signups_closed" };
  }

  const parsed = SignUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode"),
  });
  if (!parsed.success) {
    return { ok: false, error: "err_signup_validation" };
  }

  // Gate 2: constant-time compare to dodge timing side-channels.
  if (!constantTimeEqual(parsed.data.inviteCode, expected)) {
    return { ok: false, error: "err_invalid_invite" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: mapSupabaseAuthError(error.message) };

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    return { ok: true, error: "err_check_email" };
  }

  redirect("/admin");
}

/**
 * Map a free-form Supabase auth error string to one of our machine codes so
 * the login form can localise it via ADMIN_DICT. Unknown messages fall back
 * to a generic "try again" code rather than leaking raw English.
 */
function mapSupabaseAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "err_invalid_credentials";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "err_email_in_use";
  }
  if (m.includes("rate limit") || m.includes("too many")) return "err_rate_limited";
  return "err_auth_failed";
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
