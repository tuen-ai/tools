import Link from "next/link";

import { requireSession } from "@/lib/auth/require-admin";
import { signOutAction } from "@/lib/auth/actions";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { LanguageSwitch } from "@/lib/i18n/language-switch";

export async function generateMetadata() {
  const t = ADMIN_DICT[await resolveLangServer()];
  return { title: t.brand };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  const lang = await resolveLangServer();
  const t = ADMIN_DICT[lang];

  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="border-b border-cream-200 bg-white">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="font-serif text-lg text-ink-900 hover:text-blush-700 transition"
          >
            {t.brand}
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitch current={lang} />
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm text-ink-700 hover:text-ink-900 transition"
              >
                {t.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
