"use client"

import { LOCALES } from "@najimi/config"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { setLocale } from "@/lib/locale"

/** Every language Najimi speaks; switching re-renders the page in place (same URL). */
export function LanguageMenu() {
  const t = useTranslations("Language")
  const current = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <label className="sticker inline-flex items-center gap-2 px-3 py-1.5 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        value={current}
        disabled={pending}
        onChange={(event) =>
          start(async () => {
            await setLocale(event.target.value)
            router.refresh()
          })
        }
        className="bg-transparent font-semibold outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} className="text-black">
            {l.native}
            {l.beta ? ` (${t("beta")})` : ""}
          </option>
        ))}
      </select>
    </label>
  )
}
