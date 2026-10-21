"use client"

import type { StoredPick } from "@najimi/db/schema"
import { useTranslations } from "next-intl"
import { type PickActions, PickCard, PickCardSkeleton } from "./pick-card"

/** A domain's picks as a swipeable rail; skeletons while Qloo answers; an honest empty state. */
export function PickRail({
  title,
  picks,
  loading,
  emptyText,
  actionsFor,
}: {
  title: string
  picks: StoredPick[] | undefined
  loading: boolean
  emptyText: string
  actionsFor?: (pick: StoredPick) => PickActions
}) {
  const t = useTranslations("Taste")
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-title px-5 text-xl md:px-0">{title}</h2>
      {picks?.length ? (
        <div className="-my-2 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 py-3 [scrollbar-width:none] md:scroll-px-0 md:px-0">
          {picks.map((pick, i) => (
            <PickCard
              key={pick.qlooId}
              pick={pick}
              actions={actionsFor?.(pick)}
              className="animate-card-land"
              style={
                {
                  "--tilt": `${(i % 3) - 1}deg`,
                  animationDelay: `${i * 60}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ) : picks ? (
        <p className="px-5 text-sm text-text-3 md:px-0">{emptyText}</p>
      ) : loading ? (
        <div
          className="flex gap-3 overflow-hidden px-5 md:px-0"
          role="status"
          aria-label={t("computing")}
        >
          {Array.from({ length: 4 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <PickCardSkeleton key={i} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
