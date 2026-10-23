"use client"

import { LOCALES } from "@najimi/config"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { cn } from "@najimi/ui/lib/utils"
import { Check, ChevronDown, ChevronRight, Globe, Loader2, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { setLocale } from "@/lib/locale"

/**
 * Every language Najimi speaks, in a sheet: search, each language in its own name (with its English
 * name under it), the current one ticked; picking one re-renders the page in place (same URL). The
 * trigger is a pill (landing, sign-up), a globe (the desktop rail) or a settings row.
 */
export function LanguageMenu({ variant = "pill" }: { variant?: "pill" | "compact" | "row" }) {
  const t = useTranslations("Language")
  const current = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [pending, start] = useTransition()
  const [choosing, setChoosing] = useState<string | null>(null)
  const here = LOCALES.find((l) => l.code === current) ?? LOCALES[0]
  const q = query.trim().toLowerCase()
  const shown = q
    ? LOCALES.filter((l) => `${l.native} ${l.name} ${l.code}`.toLowerCase().includes(q))
    : LOCALES

  const choose = (code: string) => {
    if (code === current) return setOpen(false)
    setChoosing(code)
    start(async () => {
      await setLocale(code)
      router.refresh()
      setOpen(false)
      setChoosing(null)
    })
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        title={t("label")}
        aria-label={t("label")}
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
      >
        <Globe className="size-5" />
      </button>
    ) : variant === "row" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-white/4"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-secondary text-text-2">
          <Globe className="size-4" />
        </span>
        <span className="flex-1 text-[15px] font-semibold">{t("label")}</span>
        <span className="text-[14px] text-text-3">{here.native}</span>
        <ChevronRight className="size-4 text-text-3" />
      </button>
    ) : (
      <button
        type="button"
        aria-label={t("label")}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-pill bg-card px-3.5 text-sm font-semibold ring-1 ring-border transition-colors hover:bg-secondary"
      >
        <Globe className="size-4 text-text-3" />
        {here.native}
        <ChevronDown className="size-4 text-text-3" />
      </button>
    )

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[85svh] max-w-md flex-col gap-4 rounded-t-sheet border-0 bg-card px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground"
        >
          <SheetTitle className="font-title text-[1.7rem] font-normal">{t("label")}</SheetTitle>
          <label className="flex h-11 items-center gap-2 rounded-pill bg-background px-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 text-text-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </label>
          <ul className="-mx-2 flex flex-col overflow-y-auto">
            {shown.map((l) => {
              const on = l.code === current
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => choose(l.code)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-start transition-colors hover:bg-secondary",
                      on && "bg-secondary",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold" lang={l.code} dir={l.dir}>
                        {l.native}
                      </span>
                      <span className="text-[12px] text-text-3">
                        {l.name}
                        {l.beta ? ` · ${t("beta")}` : ""}
                      </span>
                    </span>
                    {choosing === l.code ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : on ? (
                      <Check className="size-4" />
                    ) : null}
                  </button>
                </li>
              )
            })}
            {shown.length ? null : (
              <li className="px-3 py-6 text-center text-[14px] text-text-3">{t("none")}</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
