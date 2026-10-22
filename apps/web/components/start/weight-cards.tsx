"use client"

import { TASTE } from "@najimi/config"
import { Slider } from "@najimi/ui/components/slider"
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
  return (
    <ul className="overflow-hidden rounded-card bg-card shadow-paper">
      {loves.map((l, i) => (
        <li
          key={l.qlooId}
          className="flex animate-settle-in items-center gap-3 border-b border-border p-3 last:border-b-0"
          style={{ "--enter-delay": `${i * 50}ms` } as React.CSSProperties}
        >
          <Artwork src={l.image} name={l.name} shape="poster" className="w-14 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-heading text-[15px]">{l.name}</span>
              <span className="font-mono text-sm text-text-2 tnum">{l.weight}</span>
            </span>
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
            <span className="flex justify-between text-[11px] text-text-3">
              <span>{t("less")}</span>
              <span>{t("more")}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
