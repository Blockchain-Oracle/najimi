"use client"

import { TASTE } from "@najimi/config"
import { Slider } from "@najimi/ui/components/slider"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { Artwork } from "@/components/artwork"
import { sound } from "@/lib/sounds"

/*
 * "How much does each count": every love as its own card. The more it counts, the bigger its
 * number and the stronger its lime glow, so the hand reads at a glance before the reveal.
 */

type Picked = LoveHit & { weight: number }

export function WeightCards({
  loves,
  onWeight,
}: {
  loves: Picked[]
  onWeight: (qlooId: string, weight: number) => void
}) {
  const t = useTranslations("Loves")
  const span = TASTE.weightMax - TASTE.weightMin
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {loves.map((l, i) => {
        const share = (l.weight - TASTE.weightMin) / span
        return (
          <motion.li
            key={l.qlooId}
            initial={{ opacity: 0, y: 16, rotate: (i % 2 ? 1 : -1) * 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 220, damping: 20 }}
            className="flex flex-col gap-3 rounded-card bg-card p-3 text-card-foreground shadow-paper"
          >
            <motion.div
              animate={{ scale: 0.86 + share * 0.14 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              <Artwork src={l.image} name={l.name} shape="poster" className="rounded-tile" />
              <span
                className="pointer-events-none absolute inset-0 rounded-tile ring-lime transition-[box-shadow]"
                style={{
                  boxShadow: `0 0 0 ${2 + share * 4}px rgb(201 255 61 / ${0.2 + share * 0.8})`,
                }}
              />
              <motion.span
                key={l.weight}
                initial={{ scale: 1.4, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute end-2 bottom-2 grid size-10 place-items-center rounded-full bg-lime font-title text-lg text-lime-foreground shadow-sticker tnum"
              >
                {l.weight}
              </motion.span>
            </motion.div>
            <span className="truncate text-sm font-semibold">{l.name}</span>
            <Slider
              value={[l.weight]}
              min={TASTE.weightMin}
              max={TASTE.weightMax}
              step={1}
              aria-label={t("weightFor", { name: l.name })}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? (v[0] ?? l.weight) : v
                if (next === l.weight) return
                sound("tap")
                onWeight(l.qlooId, next)
              }}
            />
            <span className="flex justify-between text-[11px] text-paper-muted">
              <span>{t("less")}</span>
              <span>{t("more")}</span>
            </span>
          </motion.li>
        )
      })}
    </ul>
  )
}
