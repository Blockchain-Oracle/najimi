"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ImageUp, Loader2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { BrandIcon } from "@/components/brands/brand-icon"
import { NumberTicker } from "@/components/games/number-ticker"
import { PLATFORMS } from "./tune-up"

/*
 * How much of your feed is you (W15): drop a screenshot of For You, Explore or Home; Najimi reads
 * what's on it, Qloo scores each thing against your taste, and the share that fits is the score.
 * What doesn't fit is named, and each try is kept so the change shows over the weeks.
 */

type Score = {
  id: string
  platform: (typeof PLATFORMS)[number]["id"]
  score: number
  matched: { qlooId: string; name: string; image: string | null; fit: number }[]
  off: string[]
  createdAt: string
}

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

function Big({ value }: { value: number }) {
  const still = useReducedMotion()
  return (
    <span className="relative grid size-28 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-white/10" />
        <motion.circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={value >= 50 ? "stroke-success" : value >= 25 ? "stroke-warn" : "stroke-danger"}
          initial={still ? false : { pathLength: 0 }}
          animate={{ pathLength: value / 100 }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      <span className="font-title text-[30px] leading-none">
        <NumberTicker value={value} />%
      </span>
    </span>
  )
}

export function FeedScore() {
  const t = useTranslations("Connect")
  const queryClient = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [platform, setPlatform] = useState<Score["platform"]>("instagram")
  const [reading, setReading] = useState(false)
  const history = useQuery({
    queryKey: ["feedscores"],
    queryFn: () => fetch("/api/feedscore").then((r) => r.json() as Promise<{ scores: Score[] }>),
  })
  const scores = history.data?.scores ?? []
  const latest = scores.find((s) => s.platform === platform) ?? null
  const trend = scores
    .filter((s) => s.platform === platform)
    .slice(0, 8)
    .reverse()

  const upload = async (picked: File) => {
    setReading(true)
    try {
      const form = new FormData()
      form.set("file", picked)
      form.set("platform", platform)
      const res = await fetch("/api/feedscore", { method: "POST", body: form })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? t("error"))
      await queryClient.invalidateQueries({ queryKey: ["feedscores"] })
      await queryClient.invalidateQueries({ queryKey: ["tuneup"] })
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setReading(false)
    }
  }

  return (
    <section className="dark flex flex-col gap-4 rounded-sheet bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
          {t("scoreKicker")}
        </span>
        <h2 className="font-title text-[22px] leading-tight">{t("scoreTitle")}</h2>
        <span className="text-[13px] text-text-3">{t("scoreLine")}</span>
      </header>
      <div className="flex gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={platform === p.id}
            onClick={() => setPlatform(p.id)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-pill px-3 text-[13px] font-semibold",
              platform === p.id ? "bg-foreground text-background" : "bg-white/5 text-text-2",
            )}
          >
            <BrandIcon icon={p.icon} className="size-3.5" /> {p.name}
          </button>
        ))}
      </div>

      {latest ? (
        <div className="flex items-center gap-4">
          <Big value={latest.score} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-[13px] text-text-2">
              {t("isYou", { count: latest.matched.length })}
            </span>
            <span className="flex -space-x-2">
              {latest.matched.slice(0, 7).map((m) => (
                // biome-ignore lint/performance/noImgElement: remote artwork
                <img
                  key={m.qlooId}
                  src={sized(m.image, 96) ?? ""}
                  alt={m.name}
                  title={m.name}
                  className="size-9 rounded-full object-cover ring-2 ring-[#0b0b0d]"
                />
              ))}
            </span>
            {trend.length > 1 ? (
              <span className="flex h-8 items-end gap-1" role="img" aria-label={t("trend")}>
                {trend.map((s) => (
                  <span
                    key={s.id}
                    className="w-3 rounded-t bg-signal/70"
                    style={{ height: `${Math.max(8, s.score)}%` }}
                  />
                ))}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {latest?.off.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-text-3 uppercase">{t("notYou")}</span>
          <div className="flex flex-wrap gap-1.5">
            {latest.off.slice(0, 10).map((o) => (
              <span
                key={o}
                className="rounded-pill bg-danger/15 px-2.5 py-1 text-[12px] font-semibold text-danger"
              >
                {o}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) void upload(picked)
          e.target.value = ""
        }}
      />
      <button
        type="button"
        disabled={reading}
        onClick={() => file.current?.click()}
        className="flex h-12 items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[15px] text-background disabled:opacity-60"
      >
        {reading ? <Loader2 className="size-5 animate-spin" /> : <ImageUp className="size-5" />}
        {reading
          ? t("reading")
          : t("scoreIt", { name: PLATFORMS.find((p) => p.id === platform)?.name ?? "" })}
      </button>
    </section>
  )
}
