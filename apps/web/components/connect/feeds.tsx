"use client"

import type { TuneUpItem } from "@najimi/db/schema"
import { Sheet, SheetContent } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronRight, Download, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { BrandIcon } from "@/components/brands/brand-icon"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { AccountSheet } from "./account-sheet"
import { AlsoFrom, BringSheet, SOURCES, type Source } from "./bring"
import { Hero } from "./hero"
import { type Live, PLATFORMS, type Platform, platformOf, zone } from "./platforms"
import { ScoreSheet } from "./score-sheet"
import { Today } from "./today"
import { TopicsSheet } from "./topics-sheet"
import { useScores, useSocialLive, useSocials, useTuneUp } from "./use-feeds"

/*
 * Your feeds (W14, W15), one platform at a time: pick X, Instagram, TikTok or YouTube once and
 * everything below is about that feed — how much of it is you, whether Najimi is connected there
 * (and following for you), today's accounts, its topics, and bringing in what you follow there.
 * Taste from beyond the four sits in one row at the end.
 */

type Open =
  | { kind: "account"; platform: Live }
  | { kind: "score" }
  | { kind: "topics"; item: TuneUpItem }
  | { kind: "bring"; source: Source; auto?: boolean }
  | null

function Row({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-card bg-card px-4 py-3.5 text-start ring-1 ring-border transition-colors hover:bg-secondary"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8 text-text-2">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{label}</span>
      <ChevronRight className="size-4 text-text-3" />
    </button>
  )
}

export function Feeds({ personId }: { personId: string }) {
  const t = useTranslations("Connect")
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform>("x")
  const [open, setOpen] = useState<Open>(null)
  const [switching, setSwitching] = useState(false)
  const socials = useSocials()
  const scores = useScores()
  const { today, items, tick } = useTuneUp()
  const live = useSocialLive(socials.data)
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Back from connecting an account elsewhere (`?bring=youtube`): that source's sheet opens and
  // reads it straight away.
  const bring = params.get("bring")
  useEffect(() => {
    const back = SOURCES.find((s) => s.id === bring)
    if (!back) return
    if (PLATFORMS.some((x) => x.id === back.id)) setPlatform(back.id as Platform)
    setOpen({ kind: "bring", source: back, auto: true })
    router.replace(pathname, { scroll: false })
  }, [bring, pathname, router])

  const p = platformOf(platform)
  const connection = socials.data?.connections.find((c) => c.platform === platform) ?? null
  const actions = socials.data?.actions ?? []
  const score = scores.data?.scores.find((s) => s.platform === platform) ?? null
  const people = items.filter((i) => i.platform === platform && i.kind !== "topics")
  const topics = items.find((i) => i.platform === platform && i.kind === "topics") ?? null
  const imported =
    actions.find((a) => a.platform === platform && a.kind === "read")?.createdAt ?? null
  const followedByNajimi = new Set(
    actions
      .filter((a) => a.platform === platform && a.kind === "follow" && a.status === "done")
      .map((a) => a.target.toLowerCase()),
  )
  const source = (SOURCES.find((s) => s.id === platform) ?? SOURCES[0]) as Source

  const autopilot = async (on: boolean) => {
    if (platform !== "x" && platform !== "instagram") return
    setSwitching(true)
    try {
      await api(`/api/socials/${platform}`, {
        method: "PATCH",
        json: { autopilot: on, tz: zone() },
      })
      sound(on ? "promote" : "tap")
      toast(on ? t("autopilotOn", { name: p.name }) : t("autopilotOff", { name: p.name }))
      await queryClient.invalidateQueries({ queryKey: ["socials"] })
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-1 rounded-pill bg-card p-1 ring-1 ring-border">
        {PLATFORMS.map((x) => {
          const left = items.filter((i) => i.platform === x.id && !i.done).length
          const on = platform === x.id
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                sound("tap")
                setPlatform(x.id)
              }}
              className={cn(
                "relative flex h-11 items-center justify-center gap-2 rounded-pill text-[14px] font-semibold transition-colors",
                on ? "text-background" : "text-text-2 hover:text-foreground",
              )}
            >
              {on ? (
                <motion.span
                  layoutId="feed-tab"
                  className="absolute inset-0 rounded-pill bg-foreground"
                  transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                />
              ) : null}
              <BrandIcon icon={x.icon} className="relative size-4" />
              <span className="relative hidden sm:inline">{x.name}</span>
              {left ? (
                <span
                  className={cn(
                    "relative size-1.5 rounded-full",
                    on ? "bg-background/60" : "bg-signal",
                  )}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <Hero
        platform={platform}
        connection={connection}
        score={score}
        imported={imported}
        switching={switching}
        onConnect={() => {
          if (platform === "x" || platform === "instagram") setOpen({ kind: "account", platform })
        }}
        onScore={() => setOpen({ kind: "score" })}
        onBring={() => setOpen({ kind: "bring", source })}
        onAutopilot={(on) => void autopilot(on)}
      />

      <Today
        items={people}
        live={live}
        auto={Boolean(connection?.autopilot && connection.status === "active")}
        followedByNajimi={followedByNajimi}
        pending={today.isPending}
        onTick={(item, done) => void tick(item, done)}
      />

      <div className="flex flex-col gap-2">
        {topics ? (
          <Row
            icon={<Sparkles className="size-4" />}
            label={t("teach", { name: p.name })}
            onClick={() => setOpen({ kind: "topics", item: topics })}
          />
        ) : null}
        <Row
          icon={<Download className="size-4" />}
          label={t("bringFrom", { name: p.name })}
          onClick={() => setOpen({ kind: "bring", source })}
        />
      </div>

      <AlsoFrom onOpen={(s) => setOpen({ kind: "bring", source: s })} />

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[88svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          {open?.kind === "account" ? (
            <AccountSheet
              platform={open.platform}
              connection={
                socials.data?.connections.find((c) => c.platform === open.platform) ?? null
              }
              actions={actions}
              personId={personId}
              onClose={() => setOpen(null)}
            />
          ) : open?.kind === "score" ? (
            <ScoreSheet platform={platform} scores={scores.data?.scores ?? []} />
          ) : open?.kind === "topics" ? (
            <TopicsSheet
              item={items.find((i) => i.id === open.item.id) ?? open.item}
              onDone={(done) => void tick(open.item, done)}
            />
          ) : open?.kind === "bring" ? (
            <BringSheet
              key={open.source.id}
              source={open.source}
              auto={open.auto}
              personId={personId}
              connected={
                connection?.status === "active" && (platform === "x" || platform === "instagram")
                  ? { platform, handle: connection.handle }
                  : null
              }
              onSwitch={(s) => setOpen({ kind: "bring", source: s })}
              onClose={() => setOpen(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
