"use client"

import { Heart } from "lucide-react"

/*
 * How much each love pulled a pick in (Qloo's explainability), as bars lit in the aura. Shared by
 * the feed's "why this?" and the profile's pick sheet.
 */

export type ShareLove = { qlooId: string; name: string; image: string | null }

export function ShareBars({
  shares,
  loves,
}: {
  shares: { id: string; share: number }[]
  loves: ShareLove[]
}) {
  const byId = new Map(loves.map((l) => [l.qlooId.toLowerCase(), l]))
  const rows = shares
    .map((s) => ({ ...s, love: byId.get(s.id.toLowerCase()) }))
    .filter((s): s is typeof s & { love: ShareLove } => Boolean(s.love))
    .sort((a, b) => b.share - a.share)
  const total = rows.reduce((sum, s) => sum + s.share, 0) || 1
  if (!rows.length) return null
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((s) => {
        const pct = Math.round((s.share / total) * 100)
        return (
          <li key={s.id} className="flex items-center gap-3">
            {s.love.image ? (
              // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
              <img
                src={s.love.image}
                alt=""
                className="size-10 shrink-0 rounded-[10px] object-cover"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white/10">
                <Heart className="size-4" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14px] font-semibold">{s.love.name}</span>
                <span className="text-[13px] text-white/70 tabular-nums">{pct}%</span>
              </div>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-aura-1),var(--color-aura-2))]"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
