"use client"

import type { NajimiTools } from "@najimi/agent"
import { Heart, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { OpenThing } from "@/components/entity/entity-provider"

/** Tells the feed (wherever it's open) to start over on the new mix. */
export const FEED_RESTART = "najimi:feed-restart"

/*
 * What Najimi changed in the feed: categories turned up or down, a new love, loves weighted.
 * The feed (open under the sheet, or the next time you go to it) starts over on the new mix.
 */
export function SteerCard({
  output,
  fresh,
}: {
  output: NajimiTools["steerFeed"]["output"]
  /** Just made (not an old card in history): the feed restarts once. */
  fresh: boolean
}) {
  const t = useTranslations("Feed")
  const td = useTranslations("Domains")
  const told = useRef(false)
  useEffect(() => {
    if (told.current || !fresh) return
    told.current = true
    window.dispatchEvent(new Event(FEED_RESTART))
  }, [fresh])
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <SlidersHorizontal className="size-4" /> {t("tuned")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {output.mix.map((m) => (
          <span
            key={m.category}
            className="rounded-pill bg-secondary px-2.5 py-1 text-[12px] font-semibold"
          >
            {td(m.category as "artist")} · {t(`levels.${m.level}` as "levels.0")}
          </span>
        ))}
        {output.loved ? (
          <OpenThing
            thing={output.lovedThing ? { ...output.lovedThing, name: output.loved } : null}
            surface="feed"
            className="inline-flex items-center gap-1 rounded-pill bg-secondary px-2.5 py-1 text-[12px] font-semibold"
          >
            <Heart className="size-3 fill-current" /> {output.loved}
          </OpenThing>
        ) : null}
        {output.weights.map((w) => (
          <OpenThing
            key={w.name}
            thing={
              w.qlooId && w.type
                ? { qlooId: w.qlooId, type: w.type, name: w.name, image: w.image ?? null }
                : null
            }
            surface="feed"
            className="rounded-pill bg-secondary px-2.5 py-1 text-[12px] font-semibold"
          >
            {w.name} · {w.weight}
          </OpenThing>
        ))}
      </div>
      <Link
        href="/feed"
        className="w-fit text-[13px] font-semibold text-text-2 underline-offset-4 hover:underline"
      >
        {t("openFeed")}
      </Link>
    </div>
  )
}
