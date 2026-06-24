import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { LanguageSwitch } from "@/lib/i18n/language-switch";
import { LoginForm } from "./login-form";

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const t = ADMIN_DICT[await resolveLangServer(sp.lang)];
  return { title: `${t.loginHeading} — ${t.brand}` };
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang = await resolveLangServer(sp.lang);
  const t = ADMIN_DICT[lang];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/admin");

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-12 bg-cream-50">
      <div className="w-full max-w-sm">
        <header className="text-center mb-8">
          <p className="uppercase tracking-[0.25em] text-xs text-blush-700 mb-2">
            {t.loginEyebrow}
          </p>
          <h1 className="font-serif text-3xl text-ink-900">{t.loginHeading}</h1>
        </header>
        <LoginForm lang={lang} />
      </div>
      <div className="mt-8">
        <LanguageSwitch current={lang} basePath="/admin/login" />
      </div>
    </main>
  );
}
