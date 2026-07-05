import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { NewEventForm } from "./form";

export async function generateMetadata() {
  const t = ADMIN_DICT[await resolveLangServer()];
  return { title: `${t.newEventHeading} — ${t.brand}` };
}

export default async function NewEventPage() {
  const lang = await resolveLangServer();
  const t = ADMIN_DICT[lang];

  return (
    <div className="max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">{t.newEventHeading}</h1>
        <p className="text-sm text-ink-700 mt-1">{t.newEventSubtitle}</p>
      </header>
      <NewEventForm lang={lang} />
    </div>
  );
}
