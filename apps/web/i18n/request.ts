import { notFound } from "next/navigation"
import * as rootParams from "next/root-params"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { loadMessages } from "@/lib/i18n"
import { routing } from "./routing"

export default getRequestConfig(async ({ locale }) => {
  let resolved = locale
  if (!resolved) {
    const fromPath = await rootParams.locale()
    if (!hasLocale(routing.locales, fromPath)) notFound()
    resolved = fromPath
  }
  return { locale: resolved, messages: await loadMessages(resolved) }
})
