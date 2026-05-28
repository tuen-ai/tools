import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — Admin",
};

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/admin");

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-12 bg-cream-50">
      <div className="w-full max-w-sm">
        <header className="text-center mb-8">
          <p className="uppercase tracking-[0.25em] text-xs text-blush-600 mb-2">
            Admin
          </p>
          <h1 className="font-serif text-3xl text-ink-900">Sign in</h1>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
