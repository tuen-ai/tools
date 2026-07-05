import { LANGUAGES, type Lang } from "./dict";

export {
  LANGUAGES,
  LANGUAGE_LABELS,
  DICT,
  lookupUploadError,
  type Lang,
  type Dict,
} from "./dict";

/** Cookie name used to persist the user's language choice. */
export const LANG_COOKIE = "wgp.lang";

/** One year in seconds — for Set-Cookie max-age. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Resolve the language in order:
 *   1. explicit `?lang=` query param (most explicit — usually a shared link)
 *   2. cookie set by the language switcher (sticky preference)
 *   3. `Accept-Language` header (best-effort initial guess)
 *   4. fallback to `'zh-Hant'` (site default)
 *
 * Caller is responsible for reading cookies / headers — this is a pure
 * function so it stays usable from both server and client contexts.
 */
export function resolveLang(input: {
  searchParamLang?: string;
  cookieLang?: string;
  acceptLanguage?: string | null;
}): Lang {
  const supported = LANGUAGES as readonly string[];

  if (input.searchParamLang && supported.includes(input.searchParamLang)) {
    return input.searchParamLang as Lang;
  }

  if (input.cookieLang && supported.includes(input.cookieLang)) {
    return input.cookieLang as Lang;
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

  return "zh-Hant";
}
