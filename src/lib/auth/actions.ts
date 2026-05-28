"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
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
    return { ok: false, error: "Please enter a valid email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };

  redirect("/admin");
}

export async function signUpAction(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) return { ok: false, error: error.message };

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    return {
      ok: true,
      error: "Check your email to confirm your account, then sign in.",
    };
  }

  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
