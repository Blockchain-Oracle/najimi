"use client"

import type { TuneUpItem } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { Bot, Check, ExternalLink, X as Failed, Loader2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { sized } from "./platforms"
import type { LiveState } from "./use-feeds"

/*
 * Today's accounts for one feed: real people, artists and brands Qloo matched to what you love,
 * each with its reason. Tap Follow (it opens the exact profile and ticks off), or let Najimi do it:
 * then the row being followed carries a travelling underline and ticks itself.
 */

function Progress({ done, total }: { done: number; total: number }) {
  const still = useReducedMotion()
  return (
    <span className="relative grid size-9 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-white/10" />
        <motion.circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-signal"
          initial={still ? false : { pathLength: 0 }}
          animate={{ pathLength: total ? done / total : 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="text-[11px] font-bold tabular-nums">{done}</span>
    </span>
  )
}

export function Today({
  items,
  live,
  auto,
  followedByNajimi,
  pending,
  onTick,
}: {
  items: TuneUpItem[]
  live: Record<string, LiveState>
  /** Najimi follows these for them (Do it for me is on). */
  auto: boolean
  followedByNajimi: Set<string>
  pending: boolean
  onTick: (item: TuneUpItem, done: boolean) => void
}) {
  const t = useTranslations("Connect")
  const still = useReducedMotion()
  const done = items.filter((i) => i.done || live[i.id]?.state === "done").length
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <Progress done={done} total={items.length} />
        <h2 className="flex-1 font-heading text-[17px]">{t("today")}</h2>
        {auto ? (
          <span className="flex items-center gap-1.5 rounded-pill bg-signal/12 px-2.5 py-1 text-[12px] font-semibold text-signal">
            <Bot className="size-3.5" /> {t("najimiDoesThese")}
          </span>
        ) : null}
      </header>
      {pending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-[76px] animate-pulse rounded-card bg-card" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const state = live[item.id]?.state
            const finished = item.done || state === "done"
            const byNajimi =
              state === "done" ||
              followedByNajimi.has((item.target ?? item.handle ?? "").toLowerCase())
            return (
              <li
                key={item.id}
                className={cn(
                  "relative flex items-center gap-3 overflow-hidden rounded-card p-3 ring-1 transition-colors",
                  finished ? "bg-success/8 ring-success/20" : "bg-card ring-border",
                )}
              >
                {state === "running" && !still ? (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 text-signal"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, transparent 0%, currentColor 50%, transparent 100%)",
                      backgroundSize: "50% 100%",
                    }}
                    animate={{ backgroundPositionX: ["0%", "200%"] }}
                    transition={{
                      duration: 1.4,
                      ease: [0.645, 0.045, 0.355, 1],
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                ) : null}
                {item.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork
                  <img
                    src={sized(item.image, 160) ?? ""}
                    alt=""
                    className="size-13 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="size-13 shrink-0 rounded-full bg-secondary" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{item.label}</span>
                  <span
                    className={cn(
                      "truncate text-[12px]",
                      state === "failed" ? "text-danger" : "text-text-3",
                    )}
                  >
                    {state === "failed"
                      ? live[item.id]?.error
                      : byNajimi
                        ? t("najimiFollowed")
                        : (item.why ?? (item.handle ? `@${item.handle}` : ""))}
                  </span>
                </span>
                {state === "running" ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-signal" />
                ) : state === "failed" ? (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
                    <Failed className="size-4" />
                  </span>
                ) : finished ? (
                  <button
                    type="button"
                    onClick={() => onTick(item, false)}
                    aria-label={t("undo")}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-black"
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </button>
                ) : (
                  <a
                    href={item.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onTick(item, true)}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-foreground px-3.5 text-[13px] font-semibold text-background"
                  >
                    {item.kind !== "follow"
                      ? t("find")
                      : item.platform === "youtube"
                        ? t("subscribe")
                        : t("follow")}
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            )
          })}
          {!items.length ? <p className="text-[13px] text-text-3">{t("allDone")}</p> : null}
        </ul>
      )}
    </section>
  )
}
