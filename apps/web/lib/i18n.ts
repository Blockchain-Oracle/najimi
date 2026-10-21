import { LOCALES, type LocaleCode } from "@najimi/config"
import en from "@/messages/en.json"

export type Messages = typeof en

/** Right-to-left scripts flip the whole layout (logical CSS everywhere). */
export const dirOf = (locale: string): "ltr" | "rtl" =>
  LOCALES.find((l) => l.code === locale)?.dir ?? "ltr"

export const isLocale = (value: string | null | undefined): value is LocaleCode =>
  LOCALES.some((l) => l.code === value)

/**
 * A language's strings laid over English, so a key a translation lacks shows in English rather
 * than as a bare key.
 */
export async function loadMessages(locale: string): Promise<Messages> {
  if (locale === "en") return en
  try {
    const own = (await import(`@/messages/${locale}.json`)) as { default: unknown }
    return overlay(en, own.default) as Messages
  } catch {
    return en
  }
}

function overlay(base: unknown, over: unknown): unknown {
  if (!isRecord(base)) return typeof over === typeof base ? over : base
  const extra = isRecord(over) ? over : {}
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      key in extra ? overlay(value, extra[key]) : value,
    ]),
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
