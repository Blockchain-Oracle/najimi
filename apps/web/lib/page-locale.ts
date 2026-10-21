import "server-only"
import type { LocaleCode } from "@najimi/config"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { isLocale } from "@/lib/i18n"

/** A page's language from its `[locale]` segment, set for every translation call below it. */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<LocaleCode> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  return locale
}
