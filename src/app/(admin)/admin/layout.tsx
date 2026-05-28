import Link from "next/link";

import { requireSession } from "@/lib/auth/require-admin";
import { signOutAction } from "@/lib/auth/actions";

export const metadata = { title: "Admin — Wedding photo sharing" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="border-b border-cream-200 bg-white">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link
            href="/admin"
            className="font-serif text-lg text-ink-900 hover:text-blush-600 transition"
          >
            Wedding photo sharing
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-ink-500 hover:text-ink-900 transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
