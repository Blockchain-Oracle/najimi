"use client"

import { LOCALES } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { Globe } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { setLocale } from "@/lib/locale"

/**
 * Every language Najimi speaks; switching re-renders the page in place (same URL). `compact` is a
 * globe for the desktop rail: the native select sits invisibly over it, so it stays a real control.
 */
export function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Language")
  const current = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  const select = (
    <select
      value={current}
      disabled={pending}
      aria-label={t("label")}
      onChange={(event) =>
        start(async () => {
          await setLocale(event.target.value)
          router.refresh()
        })
      }
      className={cn(
        "font-semibold outline-none",
        compact ? "absolute inset-0 cursor-pointer opacity-0" : "bg-transparent",
      )}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code} className="text-black">
          {l.native}
          {l.beta ? ` (${t("beta")})` : ""}
        </option>
      ))}
    </select>
  )
  if (compact)
    return (
      <span
        title={t("label")}
        className="relative grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
      >
        <Globe className="size-5" />
        {select}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-2 rounded-pill bg-card px-3.5 py-2 text-sm">
      {select}
    </span>
  )
}
