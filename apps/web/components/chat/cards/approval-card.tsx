"use client"

import { Button } from "@najimi/ui/components/button"
import { useTranslations } from "next-intl"

/**
 * Nothing paid without consent (rule 6): what will be made, from which words, and what it costs
 * from today's allowance. The reason is `images:2:8` (kind, cost, left), formatted here.
 */
export function ApprovalCard({
  title,
  words,
  reason,
  onDecide,
}: {
  title: string
  words: string[]
  reason: string | undefined
  onDecide?: (approved: boolean) => void
}) {
  const t = useTranslations("Make")
  const [kind, cost, left] = (reason ?? "").split(":")
  const n = Number(cost) || 1
  return (
    <section className="flex animate-card-land flex-col gap-3 rounded-card bg-card p-4 text-card-foreground shadow-paper">
      <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
        {t("approveKicker")}
      </p>
      <h3 className="font-heading text-[17px] leading-snug">{title}</h3>
      {words.length ? (
        <ul className="flex flex-wrap gap-1">
          {words.map((w) => (
            <li key={w} className="rounded-pill bg-paper-foreground/6 px-2 py-0.5 text-[12px]">
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm">
        {kind === "videos"
          ? t("costVideos", { n, left: Number(left) || 0 })
          : t("costImages", { n, left: Number(left) || 0 })}
      </p>
      {onDecide ? (
        <div className="flex gap-2">
          <Button onClick={() => onDecide(true)}>{t("approve")}</Button>
          <Button
            variant="ghost"
            className="text-paper-foreground hover:bg-paper-foreground/8"
            onClick={() => onDecide(false)}
          >
            {t("decline")}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
