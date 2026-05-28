import Link from "next/link";

import { LANGUAGE_LABELS, LANGUAGES, type Lang } from "./dict";

interface Props {
  current: Lang;
  /** Path without query string, e.g. "/e/sarah-and-tom". */
  basePath: string;
}

export function LanguageSwitch({ current, basePath }: Props) {
  return (
    <div className="flex justify-center gap-3 text-[11px]" role="group" aria-label="Language">
      {LANGUAGES.map((code) => (
        <Link
          key={code}
          href={`${basePath}?lang=${code}`}
          className={
            code === current
              ? "text-ink-900 font-semibold"
              : "text-ink-500 hover:text-ink-900 transition"
          }
        >
          {LANGUAGE_LABELS[code]}
        </Link>
      ))}
    </div>
  );
}
