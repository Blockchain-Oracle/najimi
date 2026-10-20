"use client"

import { TASTE_DOMAINS } from "@najimi/config"
import { Button } from "@najimi/ui/components/button"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"
import { useRunEvents } from "@/lib/use-run"
import { AttentionLine } from "./attention-line"
import { BuiltOnQloo } from "./built-on-qloo"
import { EvidenceChip } from "./evidence-chip"
import { LeanBars } from "./lean-bars"
import { TasteRow } from "./taste-row"
import type { Report } from "./types"

/** The map is heavy (MapLibre): loaded only when the report has cells to draw. */
const PeopleMap = dynamic(() => import("./people-map"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-card bg-ash sm:h-[520px]" />,
})

function SectionTitle({ children, chip }: { children: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-foreground pb-2">
      <h2 className="text-xs font-bold uppercase">{children}</h2>
      {chip}
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex gap-4" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex w-32 shrink-0 flex-col gap-2 sm:w-36">
          <div className="aspect-square animate-pulse rounded-card bg-ash" />
          <div className="h-3 w-3/4 animate-pulse rounded-sm bg-ash" />
        </div>
      ))}
    </div>
  )
}

/**
 * Your People (F3): what else they love (artwork rows), where they are (the ink map and its named
 * areas), who they are (lean), their taste in words, what's moving, and you vs a rival — each with
 * its Qloo evidence (R1), assembling live while the report builds.
 */
export function ReportView({
  businessId,
  businessName,
  initial,
  publicView = false,
}: {
  businessId: string
  businessName: string
  initial: Report | null
  publicView?: boolean
}) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: [...qk.business(businessId), "report"],
    queryFn: () =>
      api<{ report: Report | null }>(`/api/businesses/${businessId}/report`).then((r) => r.report),
    initialData: initial,
    enabled: !publicView,
  })
  const report = data
  const building = report?.status === "building"
  useRunEvents(building && !publicView ? report.runId : null, () => {
    void queryClient.invalidateQueries({ queryKey: [...qk.business(businessId), "report"] })
  })
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const share = useMutation({
    mutationFn: () => api<{ token: string }>(`/api/reports/${report?.id}/share`, { json: {} }),
    onSuccess: async ({ token }) => {
      const url = `${window.location.origin}/r/${token}`
      setShareUrl(url)
      await navigator.clipboard?.writeText(url).catch(() => undefined)
    },
  })

  if (!report) return <p className="text-sm text-text-2">No report yet.</p>
  if (report.status === "unavailable" || report.status === "failed")
    return (
      <p className="max-w-xl text-base text-text-2">
        {report.error ?? "This report couldn't be built."}
      </p>
    )

  const basisLine =
    report.basis.route === "own"
      ? `Built on ${businessName}'s own audience in Qloo.`
      : `${businessName} isn't in Qloo yet, so this is built on businesses like it: ${report.basis.entities.map((e) => e.name).join(", ")}.`

  return (
    <article className="flex flex-col gap-14">
      <header className="flex flex-col gap-6">
        <h1 className="font-display-poster text-display-sm sm:text-display">
          Your
          <br />
          people
        </h1>
        <p className="max-w-2xl text-base text-text-2">{basisLine}</p>
        {!publicView ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              disabled={building || share.isPending}
              onClick={() => share.mutate()}
            >
              {shareUrl ? "Link copied" : "Copy a share link"}
            </Button>
            <Button variant="ghost" size="sm" disabled={building} onClick={() => window.print()}>
              Save as PDF
            </Button>
            {shareUrl ? <span className="truncate text-xs text-text-3">{shareUrl}</span> : null}
          </div>
        ) : null}
      </header>

      <section className="flex flex-col gap-10" aria-label="What else your people love">
        {TASTE_DOMAINS.map((domain) => {
          const section = report.domains[domain.key]
          if (!section)
            return building ? (
              <div key={domain.key} className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase text-text-3">{domain.label}</h3>
                <RowSkeleton />
              </div>
            ) : null
          if (!section.data.length && !section.error) return null
          return (
            <TasteRow
              key={domain.key}
              domainKey={domain.key}
              label={domain.label}
              items={section.data}
              callId={section.callId}
              error={section.error}
              publicView={publicView}
            />
          )
        })}
      </section>

      {report.basis.city ? (
        <section className="flex flex-col gap-4">
          <SectionTitle
            chip={
              <EvidenceChip
                callId={report.heatmap?.callId ?? null}
                label={`Where your people are in ${report.basis.city}`}
                publicView={publicView}
              />
            }
          >
            Where they are · {report.basis.city}
          </SectionTitle>
          {report.heatmap?.error ? (
            <p className="text-sm text-text-3">{report.heatmap.error}</p>
          ) : report.heatmap ? (
            report.heatmap.data.cells.length ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
                <PeopleMap cells={report.heatmap.data.cells} areas={report.heatmap.data.areas} />
                <ol className="flex flex-col">
                  {report.heatmap.data.areas.map((area, i) => (
                    <li
                      key={area.geohash}
                      className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 text-sm"
                    >
                      <span>
                        <span className="tnum mr-2 text-text-3">{i + 1}</span>
                        {area.name}
                      </span>
                      <span className="tnum text-xs text-text-3">{area.affinity.toFixed(2)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-text-3">
                Qloo has no heatmap for {report.basis.city} yet.
              </p>
            )
          ) : building ? (
            <div className="h-[420px] animate-pulse rounded-card bg-ash" />
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-14 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionTitle
            chip={
              <EvidenceChip
                callId={report.demographics?.callId ?? null}
                label="Who your people are"
                publicView={publicView}
              />
            }
          >
            Who they are
          </SectionTitle>
          {report.demographics?.error ? (
            <p className="text-sm text-text-3">{report.demographics.error}</p>
          ) : report.demographics ? (
            <LeanBars age={report.demographics.data.age} gender={report.demographics.data.gender} />
          ) : building ? (
            <div className="h-48 animate-pulse rounded-card bg-ash" />
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle
            chip={
              <EvidenceChip
                callId={report.vocabulary?.callId ?? null}
                label="The words of your people's taste"
                publicView={publicView}
              />
            }
          >
            Their taste in words
          </SectionTitle>
          {report.vocabulary?.error ? (
            <p className="text-sm text-text-3">{report.vocabulary.error}</p>
          ) : report.vocabulary ? (
            <ul className="flex flex-wrap gap-1.5">
              {report.vocabulary.data.map((tag) => (
                <li key={tag.name} className="rounded-tag border border-border px-3 py-1 text-xs">
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : building ? (
            <div className="h-24 animate-pulse rounded-card bg-ash" />
          ) : null}
        </section>
      </div>

      {report.rising ? (
        <section className="flex flex-col gap-4">
          <SectionTitle
            chip={
              <EvidenceChip
                callId={report.rising.callId}
                label="How attention to you is moving"
                publicView={publicView}
              />
            }
          >
            What's moving
          </SectionTitle>
          {report.rising.error ? (
            <p className="text-sm text-text-3">{report.rising.error}</p>
          ) : (
            <AttentionLine points={report.rising.data.points} entity={report.rising.data.entity} />
          )}
        </section>
      ) : null}

      {report.compare && (report.compare.data.items.length || report.compare.error) ? (
        <TasteRow
          domainKey="compare"
          label={`Loved by ${report.compare.data.against}'s people`}
          items={report.compare.data.items}
          callId={report.compare.callId}
          error={report.compare.error}
          publicView={publicView}
        />
      ) : null}

      {!publicView ? <BuiltOnQloo businessId={businessId} /> : null}
    </article>
  )
}
