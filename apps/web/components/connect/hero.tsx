"use client"

import type { ConnectionView } from "@najimi/connectors/sessions"
import { Switch } from "@najimi/ui/components/switch"
import { cn } from "@najimi/ui/lib/utils"
import { ArrowUpRight, Bot, FileArchive } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { BrandIcon } from "@/components/brands/brand-icon"
import { NumberTicker } from "@/components/games/number-ticker"
import { type Platform, platformOf } from "./platforms"
import type { Score } from "./use-feeds"

/*
 * One feed at a glance: how much of it is you (the last screenshot's score, as a ring), whether
 * Najimi is connected there, and the one thing to do next. The platform's own colour glows behind
 * it — the only colour on the page, one platform at a time.
 */

function ScoreRing({ score, onOpen }: { score: Score | null; onOpen: () => void }) {
  const t = useTranslations("Connect")
  const still = useReducedMotion()
  const value = score?.score ?? 0
  const tone = !score
    ? "stroke-white/15"
    : value >= 50
      ? "stroke-success"
      : value >= 25
        ? "stroke-warn"
        : "stroke-danger"
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("scoreTitle")}
      className="relative grid size-28 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="2.6"
          className="stroke-white/8"
          strokeDasharray={score ? undefined : "1.4 2"}
        />
        {score ? (
          <motion.circle
            key={score.id}
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            className={tone}
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: value / 100 }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          />
        ) : null}
      </svg>
      <span className="flex flex-col items-center leading-none">
        {score ? (
          <span className="font-title text-[30px]">
            <NumberTicker value={value} />%
          </span>
        ) : (
          <span className="font-title text-[30px] text-text-3">?</span>
        )}
        <span className="mt-1 text-[11px] font-semibold text-text-3">
          {score ? t("isYouShort") : t("checkFeed")}
        </span>
      </span>
    </button>
  )
}

export function Hero({
  platform,
  connection,
  score,
  imported,
  switching,
  onConnect,
  onScore,
  onBring,
  onAutopilot,
}: {
  platform: Platform
  connection: ConnectionView | null
  score: Score | null
  /** When their data from this platform last came in (exports). */
  imported: string | null
  switching: boolean
  onConnect: () => void
  onScore: () => void
  onBring: () => void
  onAutopilot: (on: boolean) => void
}) {
  const t = useTranslations("Connect")
  const p = platformOf(platform)
  const active = connection?.status === "active"
  return (
    <section className="dark relative isolate overflow-hidden rounded-sheet bg-[#0b0b0d] p-5 text-foreground ring-1 ring-white/10">
      <motion.div
        key={platform}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.32 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute -top-28 -right-20 -z-10 size-80 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)` }}
      />
      <BrandIcon
        icon={p.icon}
        className="pointer-events-none absolute -right-8 -bottom-10 -z-10 size-48 -rotate-12 opacity-[0.05]"
      />
      <div className="flex items-center gap-5">
        <ScoreRing score={score} onOpen={onScore} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <button
            type="button"
            onClick={p.reach === "session" ? onConnect : onBring}
            className="flex min-w-0 items-center gap-2 text-start"
          >
            {connection?.image ? (
              // biome-ignore lint/performance/noImgElement: platform avatar
              <img src={connection.image} alt="" className="size-7 rounded-full object-cover" />
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-white">
                <BrandIcon icon={p.icon} colored className="size-3.5" />
              </span>
            )}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-heading text-[16px]">
                {connection ? `@${connection.handle}` : p.name}
              </span>
              <span
                className={cn(
                  "truncate text-[12px]",
                  connection && !active ? "text-danger" : "text-text-3",
                )}
              >
                {connection
                  ? active
                    ? t("connected")
                    : t("needsReconnect")
                  : p.reach === "session"
                    ? t("notConnected")
                    : imported
                      ? t("broughtIn")
                      : t("viaExport")}
              </span>
            </span>
          </button>

          {p.reach === "session" && active ? (
            <div className="flex items-center gap-2.5 rounded-tile bg-white/6 px-3 py-2.5">
              <Bot
                className={cn(
                  "size-4 shrink-0",
                  connection?.autopilot ? "text-signal" : "text-text-3",
                )}
              />
              <span
                id={`auto-${platform}`}
                className="min-w-0 flex-1 truncate text-[13px] font-semibold"
              >
                {t("doItForMe")}
              </span>
              <Switch
                aria-labelledby={`auto-${platform}`}
                checked={Boolean(connection?.autopilot)}
                disabled={switching}
                onCheckedChange={onAutopilot}
              />
              <Link
                href="/agents"
                className="shrink-0 text-[12px] font-semibold text-text-2 underline-offset-4 hover:underline"
              >
                {t("allAgents")}
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={p.reach === "session" ? onConnect : onBring}
              className="flex h-10 items-center justify-center gap-1.5 self-start rounded-pill bg-foreground px-4 text-[14px] font-semibold text-background"
            >
              {p.reach === "session" ? (
                <>
                  {connection ? t("reconnect") : t("connect")} <ArrowUpRight className="size-4" />
                </>
              ) : (
                <>
                  <FileArchive className="size-4" /> {t("bringData")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
