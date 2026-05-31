import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { NewEventForm } from "./form";

export const metadata = { title: "新增活動 — 婚禮相片分享" };

export default async function NewEventPage() {
  const lang = await resolveLangServer();
  const t = ADMIN_DICT[lang];

  return (
    <div className="max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">{t.newEventHeading}</h1>
        <p className="text-sm text-ink-500 mt-1">{t.newEventSubtitle}</p>
      </header>
      <NewEventForm lang={lang} />
    </div>
  );
}
