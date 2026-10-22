"use client"

import { TASTE } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { Artwork, shapeOf } from "@/components/artwork"
import { domainOf, LoveSearch } from "@/components/loves/love-search"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * "Three things you love", Spotify's pick-3 gate made of Qloo's own artwork: tap tiles from a
 * well-known mix, or search anything. What you pick fans out above like a hand of cards.
 */

type Picked = LoveHit & { weight: number }

export function LoveGrid({
  loves,
  onToggle,
  ensureSession,
}: {
  loves: Picked[]
  onToggle: (hit: LoveHit) => void
  ensureSession: () => Promise<void>
}) {
  const t = useTranslations("Start")
  const td = useTranslations("Domains")
  const popular = useQuery({
    queryKey: ["popular-loves"],
    queryFn: () => api<{ hits: LoveHit[] }>("/api/qloo/popular"),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const picked = new Set(loves.map((l) => l.qlooId))
  const full = loves.length >= TASTE.lovesMax

  const toggle = (hit: LoveHit) => {
    if (!picked.has(hit.qlooId) && full) return
    sound(picked.has(hit.qlooId) ? "tap" : "place")
    onToggle(hit)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Your picks, in a row above the grid. */}
      <div className="flex h-32 items-end justify-center gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {loves.length ? (
            loves.map((l) => {
              return (
                <motion.button
                  key={l.qlooId}
                  type="button"
                  onClick={() => toggle(l)}
                  aria-label={t("removeLove", { name: l.name })}
                  layout
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative w-20 shrink-0"
                >
                  <Artwork src={l.image} name={l.name} shape="poster" className="rounded-tile" />
                  <span className="absolute -top-1.5 -end-1.5 grid size-5 place-items-center rounded-full bg-ink text-on-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <X className="size-3.5" />
                  </span>
                </motion.button>
              )
            })
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="self-center text-center text-sm text-text-3"
            >
              {t("handEmpty")}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <LoveSearch picked={picked} ensureSession={ensureSession} onPick={(hit) => toggle(hit)} />

      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-text-3">{t("popular")}</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {(popular.data?.hits ?? []).map((hit, i) => {
            const on = picked.has(hit.qlooId)
            return (
              <motion.button
                key={hit.qlooId}
                type="button"
                onClick={() => toggle(hit)}
                aria-pressed={on}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                whileTap={{ scale: 0.94 }}
                className={cn(
                  "group flex flex-col gap-1.5 text-start",
                  !on && full && "opacity-40",
                )}
              >
                <span className="relative">
                  <Artwork
                    src={hit.image}
                    name={hit.name}
                    shape={shapeOf(hit.type) === "place" ? "square" : "poster"}
                    className={cn(
                      "transition-transform group-hover:-translate-y-0.5",
                      on && "ring-[3px] ring-lime",
                    )}
                  />
                  {on ? (
                    <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-on-ink">
                      <Check className="size-4" />
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[13px] font-semibold leading-tight">{hit.name}</span>
                <span className="text-[11px] text-text-3">
                  {td(domainOf(hit.type) as "artist")}
                </span>
              </motion.button>
            )
          })}
          {popular.isPending
            ? Array.from({ length: 9 }, (_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholders while the tiles load
                  key={i}
                  className="aspect-[2/3] animate-pulse rounded-tile bg-card"
                />
              ))
            : null}
        </div>
      </div>
    </div>
  )
}
