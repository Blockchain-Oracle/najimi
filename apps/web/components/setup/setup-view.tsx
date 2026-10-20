"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"
import { useRunEvents } from "@/lib/use-run"
import { type Fact, FactSheet } from "./fact-sheet"
import { type Match, QlooMatch } from "./qloo-match"
import { SetupSteps } from "./steps"

export type BusinessData = {
  business: {
    id: string
    url: string
    host: string | null
    status: string
    name: string | null
    kind: string | null
    category: string | null
    summary: string | null
    city: string | null
    country: string | null
    faviconUrl: string | null
    offerings: { name: string; detail: string | null }[]
    setupRunId: string | null
    error: string | null
  }
  facts: Fact[]
  matches: Match[]
  /** Which outside services this server has keys for (honest empty states, R12). */
  services: { qloo: boolean; claude: boolean }
}

/** Events that change what the page shows: refetch the business when one lands. */
const REFRESH_ON = new Set(["profile", "profile-basic", "qloo", "qloo-confirm", "qloo-unavailable"])

/**
 * Setup (F1, F2, F5): the live steps on one side; what was found, building up as it lands, on the
 * other (design: Manychat's "reading through your page" → "here's what we extracted, edit it").
 */
export function SetupView({ initial }: { initial: BusinessData }) {
  const id = initial.business.id
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: qk.business(id),
    queryFn: () => api<BusinessData>(`/api/businesses/${id}`),
    initialData: initial,
  })
  const { events, status } = useRunEvents(data.business.setupRunId, (event) => {
    const key = String(event.data.key ?? "")
    if (event.type === "status" || REFRESH_ON.has(key))
      void queryClient.invalidateQueries({ queryKey: qk.business(id) })
  })
  const b = data.business
  const found = Boolean(b.name)

  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-4">
        <h1 className="text-xs font-bold uppercase">Finding your people</h1>
        <SetupSteps events={events} status={status} />
      </aside>

      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex items-center gap-4">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-card bg-ash">
            {b.faviconUrl ? (
              <Image
                src={b.faviconUrl}
                alt=""
                fill
                sizes="48px"
                className="object-contain p-2"
                unoptimized
              />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{b.name ?? b.host}</p>
            <p className="truncate text-sm text-text-3">
              {[b.category, b.city, b.host].filter(Boolean).join(" · ")}
            </p>
          </div>
        </header>

        {found ? (
          <>
            {b.summary ? <p className="max-w-2xl text-base text-text-2">{b.summary}</p> : null}
            {b.offerings.length ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="What you offer">
                {b.offerings.map((o) => (
                  <li key={o.name} className="rounded-tag border border-border px-3 py-1 text-xs">
                    {o.name}
                  </li>
                ))}
              </ul>
            ) : null}
            <FactSheet businessId={id} facts={data.facts} />
            {["ready", "confirm", "matching"].includes(b.status) ? (
              <QlooMatch
                businessId={id}
                status={b.status}
                matches={data.matches}
                connected={data.services.qloo}
              />
            ) : null}
          </>
        ) : b.status === "failed" ? (
          <p className="text-sm text-text-2">{b.error ?? "We couldn't read this site."}</p>
        ) : (
          <div className="flex flex-col gap-3" aria-hidden>
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-ash" />
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-ash" />
            <div className="h-4 w-3/5 animate-pulse rounded-sm bg-ash" />
          </div>
        )}
      </div>
    </div>
  )
}
