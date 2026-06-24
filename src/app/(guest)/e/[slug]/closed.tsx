import { DICT, type Lang } from "@/lib/i18n";
import { BloomIcon } from "@/components/ui/icons";

export function ClosedScreen({ lang }: { lang: Lang }) {
  const t = DICT[lang];
  return (
    <div className="bg-white rounded-3xl shadow-soft p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blush-400/15 text-blush-700">
        <BloomIcon className="h-7 w-7" />
      </div>
      <h2 className="font-serif text-xl text-ink-900 mb-2">{t.closedTitle}</h2>
      <p className="text-ink-700 text-sm leading-relaxed">{t.closedBody}</p>
    </div>
  );
}
