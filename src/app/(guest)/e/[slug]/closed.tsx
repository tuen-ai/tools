import { DICT, type Lang } from "@/lib/i18n";

export function ClosedScreen({ lang }: { lang: Lang }) {
  const t = DICT[lang];
  return (
    <div className="bg-white rounded-3xl shadow-soft p-8 text-center">
      <div className="text-5xl mb-4" aria-hidden>
        💐
      </div>
      <h2 className="font-serif text-xl text-ink-900 mb-2">{t.closedTitle}</h2>
      <p className="text-ink-500 text-sm leading-relaxed">{t.closedBody}</p>
    </div>
  );
}
