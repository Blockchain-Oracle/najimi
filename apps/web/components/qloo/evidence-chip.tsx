"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@najimi/ui/components/popover"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"

type Call = {
  purpose: string | null
  path: string
  params: Record<string, string>
  status: number | null
  ms: number | null
  cacheHit: boolean
  resultCount: number | null
  createdAt: string
}

/** Signals worth showing (the rest of the query is plumbing). */
const SHOWN = [
  "filter.type",
  "signal.interests.entities",
  "signal.interests.tags",
  "filter.location.query",
  "query",
  "types",
]

function CallDetails({ callId }: { callId: string }) {
  const { data, error, isPending } = useQuery({
    queryKey: qk.qlooCall(callId),
    queryFn: () => api<{ call: Call }>(`/api/qloo-calls/${callId}`),
    staleTime: Number.POSITIVE_INFINITY,
  })
  if (isPending) return <p className="text-text-3">Loading the call…</p>
  if (error || !data) return <p className="text-text-3">This call isn't available.</p>
  const call = data.call
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      <dt className="text-text-3">Endpoint</dt>
      <dd className="font-mono break-all">GET {call.path}</dd>
      {SHOWN.filter((k) => call.params[k]).map((k) => (
        <div key={k} className="contents">
          <dt className="text-text-3">{k}</dt>
          <dd className="font-mono break-all">{call.params[k]}</dd>
        </div>
      ))}
      <dt className="text-text-3">Answer</dt>
      <dd className="tnum">
        {call.status ?? "—"} · {call.resultCount ?? 0} results ·{" "}
        {call.cacheHit ? "from cache" : `${call.ms ?? 0} ms`}
      </dd>
    </dl>
  )
}

/**
 * Evidence: every pick carries the Qloo call behind it — which endpoint, which signal, what came
 * back. Shared (public) pages show the purpose only.
 */
export function EvidenceChip({
  callId,
  label,
  publicView = false,
}: {
  callId: string | null
  label: string
  publicView?: boolean
}) {
  if (!callId) return null
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-tag border border-border px-2.5 py-0.5 text-[11px] font-bold uppercase text-text-2 transition-colors hover:border-foreground hover:text-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
        Qloo
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-card">
        <p className="text-sm font-bold">{label}</p>
        {publicView ? (
          <p className="text-xs text-text-3">From Qloo's taste data.</p>
        ) : (
          <CallDetails callId={callId} />
        )}
      </PopoverContent>
    </Popover>
  )
}
