import { DEFAULT_LOCALE } from "@najimi/config"
import { isLocale } from "@/lib/i18n"

/** The language a request comes in (the NEXT_LOCALE cookie), else the default. */
export const localeFrom = (request: Request) => {
  const match = /(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/.exec(request.headers.get("cookie") ?? "")
  return match?.[1] && isLocale(match[1]) ? match[1] : DEFAULT_LOCALE
}
