import "server-only";

import { cookies, headers } from "next/headers";

import { LANG_COOKIE, resolveLang, type Lang } from "./index";

/**
 * Server-side language resolver. Reads the cookie set by the switcher
 * and the Accept-Language header from the current request, applies the
 * priority defined in `resolveLang`.
 *
 * Use from RSCs / route handlers — every page that renders translated
 * content should call this once and pass the resolved Lang down to its
 * client islands.
 */
export async function resolveLangServer(
  searchParamLang?: string,
): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLang({
    searchParamLang,
    cookieLang: c.get(LANG_COOKIE)?.value,
    acceptLanguage: h.get("accept-language"),
  });
}
