"use client"

import { SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { useQueryClient } from "@tanstack/react-query"
import { ImageUp, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { BrandIcon } from "@/components/brands/brand-icon"
import { type Platform, platformOf, sized } from "./platforms"
import type { Score } from "./use-feeds"

/*
 * How much of a feed is you (W15), behind the ring: a screenshot of For You / Explore / Home is
 * read, every name matched by Qloo and scored against your taste (never kept). Here: who on it is
 * you, what isn't, and the score over time.
 */

export function ScoreSheet({ platform, scores }: { platform: Platform; scores: Score[] }) {
  const t = useTranslations("Connect")
  const queryClient = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const p = platformOf(platform)
  const mine = scores.filter((s) => s.platform === platform)
  const latest = mine[0] ?? null
  const trend = mine.slice(0, 8).reverse()

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
    <div className="flex flex-col gap-5 pt-5">
      <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
          <BrandIcon icon={p.icon} colored className="size-5" />
        </span>
        {latest ? t("scoreOf", { score: latest.score }) : t("scoreTitle")}
      </SheetTitle>

      {latest ? (
        <>
          {latest.matched.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[12px] font-bold tracking-[0.06em] text-text-3 uppercase">
                {t("isYou", { count: latest.matched.length })}
              </h3>
              <div className="flex flex-wrap gap-2">
                {latest.matched.slice(0, 12).map((m) => (
                  <span
                    key={m.qlooId}
                    className="flex items-center gap-2 rounded-pill bg-card py-1 ps-1 pe-3 ring-1 ring-border"
                  >
                    {m.image ? (
                      // biome-ignore lint/performance/noImgElement: remote artwork
                      <img
                        src={sized(m.image, 64) ?? ""}
                        alt=""
                        className="size-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="size-7 rounded-full bg-secondary" />
                    )}
                    <span className="text-[13px] font-semibold">{m.name}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          {latest.off.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[12px] font-bold tracking-[0.06em] text-text-3 uppercase">
                {t("notYou")}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {latest.off.slice(0, 12).map((o) => (
                  <span
                    key={o}
                    className="rounded-pill bg-danger/12 px-2.5 py-1 text-[12px] font-semibold text-danger"
                  >
                    {o}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          {trend.length > 1 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[12px] font-bold tracking-[0.06em] text-text-3 uppercase">
                {t("trend")}
              </h3>
              <div className="flex h-16 items-end gap-1.5" role="img" aria-label={t("trend")}>
                {trend.map((s) => (
                  <span
                    key={s.id}
                    title={`${s.score}%`}
                    className="flex-1 rounded-t-md bg-signal/70"
                    style={{ height: `${Math.max(6, s.score)}%` }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="text-[14px] text-text-2">{t("scoreHow", { name: p.name })}</p>
      )}

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
        className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-60"
      >
        {reading ? <Loader2 className="size-5 animate-spin" /> : <ImageUp className="size-5" />}
        {reading ? t("reading") : latest ? t("scoreAgain") : t("scoreIt", { name: p.name })}
      </button>
      <p className="-mt-2 text-center text-[12px] text-text-3">{t("neverKept")}</p>
    </div>
  )
}
