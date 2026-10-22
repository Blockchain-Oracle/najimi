"use client"

import type { NajimiTools, Pick } from "@najimi/agent"
import { toast } from "@najimi/ui/components/sonner"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { PickCard } from "@/components/picks/pick-card"
import { api } from "@/lib/fetcher"
import { StepChip } from "../lookup-step"
import { usePublicShare } from "../public-share"
import { TextShimmer } from "../text-shimmer"
import { DemographicsView } from "./demographics"
import { HeatmapView } from "./heatmap"
import { QlooChip } from "./qloo-chip"
import { TagCloud } from "./tag-cloud"

type Output = NajimiTools["qlooInsights"]["output"]
type Input = NajimiTools["qlooInsights"]["input"]

export function CardShell({
  title,
  callId,
  children,
  chips,
}: {
  title: string
  callId: string | null
  children: React.ReactNode
  chips?: React.ReactNode
}) {
  return (
    <section className="flex animate-card-land flex-col gap-3 rounded-card bg-card p-4 text-card-foreground shadow-paper">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <QlooChip callId={callId} />
          <h3 className="font-title text-lg leading-tight">{title}</h3>
        </div>
        {chips}
      </header>
      {children}
    </section>
  )
}

export function CardSkeleton({ title, label }: { title?: string; label: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-card/90 p-4 text-card-foreground shadow-paper">
      <div className="flex items-center gap-2">
        <span className="size-2 animate-lime-pulse rounded-full bg-lime-ink" />
        {title ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-title text-lg">{title}</span>
            <TextShimmer tone="paper" className="text-xs font-semibold">
              {label}
            </TextShimmer>
          </span>
        ) : (
          <TextShimmer tone="paper" className="font-title text-lg">
            {label}
          </TextShimmer>
        )}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="aspect-square w-32 shrink-0 animate-pulse rounded-tile bg-paper-foreground/8"
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Whatever Qloo answered, as a card: picks of any kind (with the same actions everywhere), the
 * words of a taste, where in a city it lives, or who it leans to. The chips say what was asked.
 */
export function InsightsCard({
  input,
  output,
  onAsk,
}: {
  input?: Partial<Input>
  output: Output
  onAsk: (text: string) => void
}) {
  const t = useTranslations("Cards")
  const ta = useTranslations("Asked")
  const tp = useTranslations("Pick")
  const share = usePublicShare()
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const chips = output.asked.length ? (
    <ul className="flex flex-wrap gap-1">
      {output.asked.map((a) => (
        <li
          key={`${a.k}-${a.v}`}
          className="rounded-pill bg-paper-foreground/6 px-2 py-0.5 text-[11px] font-medium"
        >
          {ta(a.k as "city", { v: a.v })}
        </li>
      ))}
    </ul>
  ) : null

  const actions = (pick: Pick) => ({
    saved: saved.has(pick.qlooId),
    onToggleSave: async () => {
      const on = !saved.has(pick.qlooId)
      setSaved((s) => {
        const n = new Set(s)
        if (on) n.add(pick.qlooId)
        else n.delete(pick.qlooId)
        return n
      })
      await api(`/api/people/${output.personId}/saved`, {
        method: on ? "POST" : "DELETE",
        json: on
          ? { qlooId: pick.qlooId, type: pick.type, name: pick.name, image: pick.image }
          : { qlooId: pick.qlooId },
      }).catch(() => undefined)
    },
    onMore: () => onAsk(t("moreLikeAsk", { name: pick.name })),
    onNotForMe: async () => {
      setHidden((h) => new Set(h).add(pick.qlooId))
      await api(`/api/people/${output.personId}/not-for-me`, {
        json: { qlooId: pick.qlooId },
      }).catch(() => undefined)
      toast(tp("removed"))
    },
  })

  const picks = output.picks?.filter((p) => !hidden.has(p.qlooId)) ?? []
  // An empty answer is a step on the way (the agent usually asks again, better), not a card.
  if (!output.picks?.length && !output.tags?.length && !output.heatmap && !output.demographics)
    return (
      <StepChip
        kind="search"
        text={t("nothingFor", { title: output.title || input?.title || "" })}
      />
    )
  return (
    <CardShell title={output.title || input?.title || ""} callId={output.callId} chips={chips}>
      {output.picks ? (
        picks.length ? (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:thin]">
            {picks.map((p, i) => (
              <PickCard
                key={p.qlooId}
                pick={p}
                actions={share ? undefined : actions(p)}
                className="animate-card-land border border-paper-foreground/8 shadow-none"
                style={
                  {
                    "--tilt": `${(i % 3) - 1}deg`,
                    animationDelay: `${i * 50}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        ) : null
      ) : null}
      {output.tags?.length ? (
        <TagCloud
          tags={output.tags}
          kindLabel={(k) =>
            t.has(`tagKinds.${k}` as "tagKinds.style")
              ? t(`tagKinds.${k}` as "tagKinds.style")
              : k.replaceAll("_", " ")
          }
        />
      ) : null}
      {output.heatmap ? (
        <div className="flex flex-col gap-3">
          <HeatmapView
            points={output.heatmap.points}
            areas={output.heatmap.areas}
            attribution="© OpenStreetMap contributors"
          />
          <ol className="flex flex-col gap-1.5">
            {output.heatmap.areas.map((a, i) => (
              <li key={a.name} className="text-sm">
                <span className="font-semibold">
                  {i + 1}. {a.name}
                </span>
                {a.places.length ? (
                  <span className="text-paper-muted"> — {a.places.join(", ")}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {output.demographics ? (
        <DemographicsView
          age={output.demographics.age}
          gender={output.demographics.gender}
          label={(k) =>
            t.has(`demo.${k}` as "demo.male")
              ? t(`demo.${k}` as "demo.male")
              : k.replaceAll("_", " ")
          }
        />
      ) : null}
    </CardShell>
  )
}
