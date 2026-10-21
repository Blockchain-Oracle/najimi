import { DEFAULT_LOCALE, LOCALES } from "@najimi/config"
import { defineRouting } from "next-intl/routing"

/**
 * One URL per page in every language: the language lives in a cookie (and in the person's
 * settings), never in the path. Pages still sit under `app/[locale]` so each language's static
 * shell is prerendered (reading cookies in a root layout would break `cacheComponents`).
 */
export const LOCALE_COOKIE = "NEXT_LOCALE"
const YEAR_S = 60 * 60 * 24 * 365

export const routing = defineRouting({
  locales: LOCALES.map((l) => l.code),
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "never",
  localeCookie: { name: LOCALE_COOKIE, maxAge: YEAR_S },
})
