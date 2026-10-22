"use client"

import type { TuneUpItem } from "@najimi/db/schema"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, Check, Copy, ExternalLink, X as Failed, Hand, Loader2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { siInstagram, siTiktok, siX, siYoutube } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { celebrate } from "@/components/games/confetti"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { CONNECT_EVENT, useSocials, tz as zone } from "./accounts"

/*
 * Today's tune-up (W15): five minutes that turn your feeds toward your taste. Real accounts Qloo
 * matched to what you love (with their handles), and your taste as topics for each platform's own
 * feed controls. Tap to open the exact profile or intent; it ticks off. A fresh list each day.
 * On X and Instagram, "Do it for me" hands the follows to Najimi, which does them slowly with your
 * own connected account while you watch each one tick off here. After Duolingo's daily quests
 * (Refero 0966d27a, 274b36f1); the running row's underline is 21st.dev educalvolpz/ai-task-list.
 */

export const PLATFORMS = [
  { id: "x", icon: siX, name: "X" },
  { id: "instagram", icon: siInstagram, name: "Instagram" },
  { id: "tiktok", icon: siTiktok, name: "TikTok" },
  { id: "youtube", icon: siYoutube, name: "YouTube" },
] as const
type Platform = (typeof PLATFORMS)[number]["id"]
type LiveState = { state: "running" | "done" | "failed"; url?: string; error?: string }

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

function Ring({ done, total }: { done: number; total: number }) {
  const still = useReducedMotion()
  const share = total ? done / total : 0
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3.5"
          className="stroke-white/10"
        />
        <motion.circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="stroke-signal"
          initial={still ? false : { pathLength: 0 }}
          animate={{ pathLength: share }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="font-title text-[15px] tabular-nums">
        {done}/{total}
      </span>
    </span>
  )
}

export function TuneUp() {
  const t = useTranslations("Connect")
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform>("x")
  const tz =
    typeof window === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = useQuery({
    queryKey: ["tuneup"],
    queryFn: () =>
      api<{ day: string; items: TuneUpItem[] }>(`/api/tuneup?tz=${encodeURIComponent(tz)}`),
    staleTime: 10 * 60_000,
  })
  const items = today.data?.items ?? []
  const done = items.filter((i) => i.done).length
  const shown = items.filter((i) => i.platform === platform)

  const tick = async (item: TuneUpItem, value = true) => {
    if (!today.data) return
    queryClient.setQueryData(["tuneup"], {
      ...today.data,
      items: items.map((i) => (i.id === item.id ? { ...i, done: value } : i)),
    })
    if (value) sound("check")
    if (value && done + 1 === items.length) void celebrate()
    await api("/api/tuneup", { json: { day: today.data.day, itemId: item.id, done: value } }).catch(
      () => queryClient.invalidateQueries({ queryKey: ["tuneup"] }),
    )
  }

  // "Do it for me": who's connected, what Najimi did, and its run as it happens.
  const socials = useSocials()
  const connection = socials.data?.connections.find((c) => c.platform === platform) ?? null
  const actsFor = platform === "x" || platform === "instagram"
  const auto = Boolean(connection?.autopilot && connection.status === "active")
  const [live, setLive] = useState<Record<string, LiveState>>({})
  const [switching, setSwitching] = useState(false)
  const byNajimi = new Map(
    (socials.data?.actions ?? []).flatMap((a) =>
      a.status === "done" && a.url ? [[a.target.toLowerCase(), a.url]] : [],
    ),
  )
  const after = socials.data?.after
  const watching = Boolean(socials.data?.connections.some((c) => c.autopilot))
  useEffect(() => {
    if (!watching || after === undefined) return
    const source = new EventSource(`/api/me/live?after=${after}`)
    source.onmessage = (e: MessageEvent<string>) => {
      const { type, data } = JSON.parse(e.data) as {
        type: string
        data: { itemId?: string; state?: string; url?: string; error?: string }
      }
      if (type !== "social") return
      if (
        data.itemId &&
        (data.state === "running" || data.state === "done" || data.state === "failed")
      ) {
        const state = data.state
        setLive((m) => ({
          ...m,
          [data.itemId as string]: { state, url: data.url, error: data.error },
        }))
        if (state === "done") sound("check")
      }
      if (data.state === "finished") {
        void queryClient.invalidateQueries({ queryKey: ["tuneup"] })
        void queryClient.invalidateQueries({ queryKey: ["socials"] })
      }
    }
    return () => source.close()
  }, [watching, after, queryClient])

  const setMode = async (on: boolean) => {
    if (!actsFor) return
    if (on && connection?.status !== "active") {
      window.dispatchEvent(new CustomEvent(CONNECT_EVENT, { detail: platform }))
      return
    }
    setSwitching(true)
    try {
      await api(`/api/socials/${platform}`, {
        method: "PATCH",
        json: { autopilot: on, tz: zone() },
      })
      sound(on ? "promote" : "tap")
      await queryClient.invalidateQueries({ queryKey: ["socials"] })
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setSwitching(false)
    }
  }

  return (
    <section className="dark flex flex-col gap-4 rounded-sheet bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <header className="flex items-center gap-3">
        <Ring done={done} total={items.length} />
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
            {t("today")}
          </span>
          <h2 className="font-title text-[22px] leading-tight">{t("tuneUp")}</h2>
          <span className="text-[13px] text-text-3">{t("tuneUpLine")}</span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-1.5 rounded-pill bg-white/5 p-1">
        {PLATFORMS.map((p) => {
          const left = items.filter((i) => i.platform === p.id && !i.done).length
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={platform === p.id}
              onClick={() => setPlatform(p.id)}
              className={cn(
                "relative flex h-10 items-center justify-center gap-1.5 rounded-pill text-[13px] font-semibold transition-colors",
                platform === p.id ? "bg-foreground text-background" : "text-text-2",
              )}
            >
              <BrandIcon icon={p.icon} className="size-4" />
              <span className="hidden sm:inline">{p.name}</span>
              {left ? (
                <span className="absolute -top-1 -end-1 grid size-4 place-items-center rounded-full bg-signal text-[10px] font-bold text-signal-foreground">
                  {left}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {actsFor ? (
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-pill bg-white/5 p-1">
            {[
              { on: false, icon: Hand, label: t("illTap") },
              { on: true, icon: Bot, label: t("doItForMe") },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                disabled={switching || socials.isPending}
                aria-pressed={auto === m.on}
                onClick={() => void setMode(m.on)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-pill text-[13px] font-semibold transition-colors",
                  auto === m.on ? "bg-white/12 text-foreground" : "text-text-3",
                )}
              >
                <m.icon className={cn("size-3.5", m.on && auto && "text-signal")} />
                {m.label}
              </button>
            ))}
          </div>
          {switching ? <Loader2 className="size-4 animate-spin text-text-3" /> : null}
        </div>
      ) : null}
      {actsFor && auto ? (
        <p className="-mt-2 text-[12px] text-text-3">
          {connection?.pausedUntil
            ? t("pausedUntil")
            : t("autoLine", { handle: connection?.handle ?? "" })}
        </p>
      ) : null}

      {today.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-16 animate-pulse rounded-tile bg-white/5" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((item) => (
            <li
              key={item.id}
              className={cn(
                "relative flex items-center gap-3 rounded-tile p-2.5 transition-colors",
                item.done || live[item.id]?.state === "done" ? "bg-success/10" : "bg-white/5",
              )}
            >
              {item.kind === "topics" ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-[15px]">{item.label}</span>
                    <span className="text-[11px] text-text-3">{item.why}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(item.words ?? []).map((w) => (
                      <span
                        key={w}
                        className="rounded-pill bg-white/8 px-2.5 py-1 text-[12px] font-semibold"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard
                          .writeText((item.words ?? []).join(", "))
                          .catch(() => undefined)
                        toast(t("copied"))
                      }}
                      className="flex h-8 items-center gap-1.5 rounded-pill bg-white/10 px-3 text-[12px] font-semibold"
                    >
                      <Copy className="size-3.5" /> {t("copy")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void tick(item, !item.done)}
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-pill px-3 text-[12px] font-semibold",
                        item.done ? "bg-success text-black" : "bg-foreground text-background",
                      )}
                    >
                      <Check className="size-3.5" /> {item.done ? t("doneIt") : t("markDone")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {live[item.id]?.state === "running" ? (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-3 bottom-0 h-px text-signal"
                      style={{
                        backgroundImage:
                          "linear-gradient(90deg, transparent 0%, currentColor 50%, transparent 100%)",
                        backgroundSize: "50% 100%",
                      }}
                      animate={{ backgroundPositionX: ["0%", "200%"] }}
                      transition={{
                        duration: 1.4,
                        ease: [0.645, 0.045, 0.355, 1],
                        repeat: Infinity,
                      }}
                    />
                  ) : null}
                  {item.image ? (
                    // biome-ignore lint/performance/noImgElement: remote artwork
                    <img
                      src={sized(item.image, 120) ?? ""}
                      alt=""
                      className="size-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="size-11 shrink-0 rounded-full bg-white/10" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-semibold">{item.label}</span>
                    <span className="truncate text-[12px] text-text-3">
                      {live[item.id]?.state === "failed"
                        ? live[item.id]?.error
                        : (live[item.id]?.state === "done" ||
                              byNajimi.has((item.target ?? item.handle ?? "").toLowerCase())) &&
                            actsFor
                          ? t("najimiFollowed")
                          : `${item.handle ? `@${item.handle} · ` : ""}${item.why ?? ""}`}
                    </span>
                  </span>
                  {live[item.id]?.state === "running" ? (
                    <span className="flex h-9 shrink-0 items-center gap-1.5 px-2 text-[12px] font-semibold text-signal">
                      <Loader2 className="size-3.5 animate-spin" /> {t("najimiFollowing")}
                    </span>
                  ) : live[item.id]?.state === "failed" ? (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
                      <Failed className="size-4" />
                    </span>
                  ) : item.done || live[item.id]?.state === "done" ? (
                    <button
                      type="button"
                      onClick={() => void tick(item, false)}
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
                      onClick={() => void tick(item, true)}
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
                </>
              )}
            </li>
          ))}
          {!shown.length ? <p className="text-[13px] text-text-3">{t("allDone")}</p> : null}
        </ul>
      )}
      {today.isFetching && !today.isPending ? (
        <Loader2 className="mx-auto size-4 animate-spin text-text-3" />
      ) : null}
    </section>
  )
}
