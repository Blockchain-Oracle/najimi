"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/** Something Qloo recognised in what was brought in, and what it was called there. */
export type Hit = {
  qlooId: string
  type: string
  name: string
  image: string | null
  caption: string | null
  from: string
}

/** Matches from an import, all kept to start with; tap to drop, then add the rest to your taste. */
export function ReviewHits({
  personId,
  hits,
  onAdded,
}: {
  personId: string
  hits: Hit[]
  onAdded: () => void
}) {
  const t = useTranslations("Connect")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [kept, setKept] = useState<Set<string>>(() => new Set(hits.map((h) => h.qlooId)))
  const [adding, setAdding] = useState(false)

  const add = async () => {
    const chosen = hits.filter((h) => kept.has(h.qlooId))
    if (!chosen.length) return
    setAdding(true)
    try {
      const r = await api<{ added: number }>(`/api/people/${personId}/loves/batch`, {
        json: {
          loves: chosen.map((h) => ({
            qlooId: h.qlooId,
            type: h.type,
            name: h.name,
            image: h.image,
            weight: 6,
          })),
        },
      })
      toast(t("added", { count: r.added }))
      sound("check")
      void queryClient.invalidateQueries({ queryKey: ["tuneup"] })
      router.refresh()
      onAdded()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setAdding(false)
    }
  }

  if (!hits.length) return <p className="text-[14px] text-text-3">{t("noneFound")}</p>
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-text-2">{t("foundSome", { count: hits.length })}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {hits.map((h) => {
          const on = kept.has(h.qlooId)
          return (
            <li key={h.qlooId}>
              <button
                type="button"
                aria-pressed={on}
                title={h.from}
                onClick={() =>
                  setKept((s) => {
                    const next = new Set(s)
                    if (on) next.delete(h.qlooId)
                    else next.add(h.qlooId)
                    return next
                  })
                }
                className={cn(
                  "relative flex w-full flex-col overflow-hidden rounded-tile bg-card text-start ring-2 transition-[box-shadow,opacity]",
                  on ? "ring-signal" : "opacity-50 ring-transparent",
                )}
              >
                {h.image ? (
                  // biome-ignore lint/performance/noImgElement: remote artwork
                  <img src={h.image} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span className="aspect-square w-full bg-secondary" />
                )}
                <span className="truncate px-2 pt-1.5 text-[12px] font-semibold">{h.name}</span>
                <span className="truncate px-2 pb-1.5 text-[11px] text-text-3">{h.from}</span>
                {on ? (
                  <span className="absolute top-1.5 end-1.5 grid size-5 place-items-center rounded-full bg-signal text-signal-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        disabled={adding || !kept.size}
        onClick={() => void add()}
        className="sticky bottom-0 flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
      >
        {adding ? <Loader2 className="size-5 animate-spin" /> : null}
        {t("addKept", { count: kept.size })}
      </button>
    </div>
  )
}
