"use client"

import { cn } from "@najimi/ui/lib/utils"
import { X as Failed, UserPlus } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { siInstagram, siTiktok, siX, siYoutube } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { useSocials } from "./accounts"

/*
 * What Najimi did on your accounts: every follow it made (or couldn't), newest first, each a link
 * to the account. After 21st.dev olewandowski1/activity-3 (icon tile, title, detail, tag, time).
 */

const ICONS = { x: siX, instagram: siInstagram, tiktok: siTiktok, youtube: siYoutube } as const
const NAMES = { x: "X", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" } as const

export function Activity() {
  const t = useTranslations("Connect")
  const format = useFormatter()
  // Our own clock: the provider's `now` can be older than an action that just happened.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(tick)
  }, [])
  const socials = useSocials()
  const actions = socials.data?.actions ?? []
  if (!actions.length) return null
  return (
    <section className="flex flex-col overflow-hidden rounded-card bg-card ring-1 ring-border">
      <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h2 className="font-heading text-[15px]">{t("activityTitle")}</h2>
        {actions.some((a) => a.status === "done") ? (
          <span className="rounded-pill bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-text-2">
            {t("activityCount", { count: actions.filter((a) => a.status === "done").length })}
          </span>
        ) : null}
      </header>
      <ul className="flex flex-col divide-y divide-border">
        {actions.slice(0, 12).map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-tile",
                a.status === "done" ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
              )}
            >
              {a.status === "done" ? (
                <UserPlus className="size-4" />
              ) : (
                <Failed className="size-4" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[14px] font-semibold hover:underline"
                  >
                    {a.status === "done"
                      ? t("didFollow", { name: a.label ?? a.target })
                      : t("couldntFollow", { name: a.label ?? a.target })}
                  </a>
                ) : (
                  <span className="truncate text-[14px] font-semibold">
                    {a.status === "done"
                      ? t("didFollow", { name: a.label ?? a.target })
                      : t("couldntFollow", { name: a.label ?? a.target })}
                  </span>
                )}
                <span className="flex shrink-0 items-center gap-1 rounded-pill bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-text-2">
                  <BrandIcon icon={ICONS[a.platform]} className="size-2.5" />
                  {NAMES[a.platform]}
                </span>
              </div>
              <span className="truncate text-[12px] text-text-3">
                {a.status === "done" ? `@${a.target}` : (a.detail ?? `@${a.target}`)}
              </span>
            </div>
            <time
              dateTime={a.createdAt}
              className="shrink-0 text-[11px] text-text-3 tabular-nums"
              suppressHydrationWarning
            >
              {format.relativeTime(new Date(Math.min(Date.parse(a.createdAt), now.getTime())), now)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
