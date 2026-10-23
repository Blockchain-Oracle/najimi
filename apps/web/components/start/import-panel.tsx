"use client"

import { TASTE } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowRight, AtSign, Check, Loader2 } from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { siGoodreads, siInstagram, siLastdotfm, siLetterboxd, siX } from "simple-icons"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { Artwork, shapeOf } from "@/components/artwork"
import { BrandIcon } from "@/components/brands/brand-icon"
import { domainOf } from "@/components/loves/love-search"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * "Bring your taste": what you already keep somewhere else, read by name with no sign-in. A
 * Letterboxd diary, a Goodreads shelf, Last.fm's top artists, or X / Instagram handles. Qloo
 * matches each to the real thing (exactly, by its id there, where it can); you keep what's you.
 */

type Source = "letterboxd" | "goodreads" | "lastfm" | "handles"
type Found = LoveHit & { from: string }

const MARKS: Record<Source, React.ReactNode> = {
  letterboxd: <BrandIcon icon={siLetterboxd} colored />,
  goodreads: <BrandIcon icon={siGoodreads} />,
  lastfm: <BrandIcon icon={siLastdotfm} colored />,
  handles: (
    <span className="flex items-center gap-1">
      <BrandIcon icon={siX} className="size-4" />
      <BrandIcon icon={siInstagram} colored className="size-4" />
    </span>
  ),
}

export function ImportPanel({
  picked,
  onToggle,
  ensureSession,
}: {
  picked: Set<string>
  onToggle: (hit: LoveHit) => void
  ensureSession: () => Promise<void>
}) {
  const t = useTranslations("Start")
  const td = useTranslations("Domains")
  const [source, setSource] = useState<Source | null>(null)
  const [value, setValue] = useState("")
  const available = useQuery({
    queryKey: ["import-sources"],
    queryFn: () => api<{ sources: Source[] }>("/api/imports"),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const run = useMutation({
    mutationFn: async (input: { source: Source; value: string }) => {
      await ensureSession()
      return api<{ hits: Found[]; tried: number }>("/api/imports", { json: input })
    },
    onSuccess: () => sound("promote"),
  })
  const full = picked.size >= TASTE.lovesMax
  const found = run.data?.hits ?? []

  const choose = (s: Source) => {
    sound("tap")
    setSource(s)
    setValue("")
    run.reset()
  }
  const addAll = () => {
    let room = TASTE.lovesMax - picked.size
    for (const hit of found) {
      if (room <= 0) break
      if (!picked.has(hit.qlooId)) {
        onToggle(hit)
        room--
      }
    }
    sound("place")
  }

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-[17px]">{t("importTitle")}</h2>
        <p className="text-sm text-text-3">{t("importHint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(available.data?.sources ?? []).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => choose(s)}
            aria-pressed={source === s}
            className={cn(
              "inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors",
              source === s
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-secondary",
            )}
          >
            {MARKS[s]}
            {t(`sources.${s}`)}
          </button>
        ))}
      </div>

      {source ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) run.mutate({ source, value })
          }}
        >
          <label className="flex h-12 flex-1 items-center gap-2 rounded-pill bg-background px-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
            {source === "handles" ? <AtSign className="size-4 text-text-3" /> : null}
            <span className="sr-only">{t(`placeholders.${source}`)}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t(`placeholders.${source}`)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-4"
            />
          </label>
          <button
            type="submit"
            disabled={!value.trim() || run.isPending}
            aria-label={t("bring")}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {run.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowRight className="size-5 rtl:-scale-x-100" />
            )}
          </button>
        </form>
      ) : null}

      {run.isPending ? (
        <p className="text-sm text-text-3" aria-live="polite">
          {t("bringing")}
        </p>
      ) : run.error ? (
        <p className="text-sm text-destructive" aria-live="polite">
          {run.error.message}
        </p>
      ) : run.data ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-2">
              {found.length
                ? t("importFound", { found: found.length, tried: run.data.tried })
                : t("importNone")}
            </p>
            {found.length && !full ? (
              <button
                type="button"
                onClick={addAll}
                className="rounded-pill px-3 py-1.5 text-sm font-semibold ring-1 ring-border hover:bg-background"
              >
                {t("addAll")}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {found.map((hit, i) => {
              const on = picked.has(hit.qlooId)
              return (
                <motion.button
                  key={hit.qlooId}
                  type="button"
                  onClick={() => {
                    if (!on && full) return
                    sound(on ? "tap" : "place")
                    onToggle(hit)
                  }}
                  aria-pressed={on}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  whileTap={{ scale: 0.95 }}
                  className={cn("flex flex-col gap-1 text-start", !on && full && "opacity-40")}
                >
                  <span className="relative">
                    <Artwork
                      src={hit.image}
                      name={hit.name}
                      shape={shapeOf(hit.type) === "place" ? "square" : "poster"}
                      className={cn(on && "ring-[3px] ring-primary")}
                    />
                    {on ? (
                      <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-[13px] font-semibold leading-tight">
                    {hit.name}
                  </span>
                  <span className="truncate text-[11px] text-text-3">
                    {td(domainOf(hit.type) as "artist")}
                    {hit.from.startsWith("@") ? ` · ${hit.from}` : ""}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
