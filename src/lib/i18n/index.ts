import { LANGUAGES, type Lang } from "./dict";

export { LANGUAGES, LANGUAGE_LABELS, DICT, type Lang, type Dict } from "./dict";

/**
 * Resolve the guest's language from (in order):
 *   1. an explicit `?lang=` query param
 *   2. the Accept-Language header
 *   3. fallback to 'en'
 *
 * Both inputs are optional — server pages should pass whatever they
 * have. Caller is responsible for reading the cookie/header.
 */
export function resolveLang(input: {
  searchParamLang?: string;
  acceptLanguage?: string | null;
}): Lang {
  const supported = LANGUAGES as readonly string[];

  if (input.searchParamLang && supported.includes(input.searchParamLang)) {
    return input.searchParamLang as Lang;
  }

  if (input.acceptLanguage) {
    const tags = input.acceptLanguage
      .split(",")
      .map((t) => t.split(";")[0]!.trim().toLowerCase());
    for (const tag of tags) {
      if (
        tag.startsWith("zh-hant") ||
        tag === "zh-tw" ||
        tag === "zh-hk" ||
        tag === "zh-mo"
      ) {
        return "zh-Hant";
      }
      if (tag.startsWith("en")) return "en";
    }
  }

  return "en";
}
