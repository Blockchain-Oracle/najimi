"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"

type Call = {
  id: string
  purpose: string | null
  path: string
  status: number | null
  ms: number | null
  cacheHit: boolean
  resultCount: number | null
  error: string | null
  createdAt: string
}

/**
 * Built on Qloo (plan §7): every Qloo call this business's work made — what it was for, the
 * endpoint, what came back — so anyone can see each step above is a Qloo call.
 */
export function BuiltOnQloo({ businessId }: { businessId: string }) {
  const { data } = useQuery({
    queryKey: qk.qlooCalls(businessId),
    queryFn: () => api<{ calls: Call[] }>(`/api/businesses/${businessId}/qloo-calls`),
  })
  const calls = data?.calls ?? []
  if (!calls.length) return null
  return (
    <details className="group border-t border-foreground pt-3 print:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold uppercase">
        <span>Built on Qloo · {calls.length} calls</span>
        <span className="text-text-3 group-open:hidden">Show</span>
        <span className="hidden text-text-3 group-open:inline">Hide</span>
      </summary>
      <ul className="mt-3 flex flex-col">
        {calls.map((call) => (
          <li
            key={call.id}
            className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-border py-2 text-sm"
          >
            <span className="min-w-0 truncate">{call.purpose ?? call.path}</span>
            <span className="tnum text-xs text-text-3">
              {call.error ? "failed" : call.cacheHit ? "cache" : `${call.ms ?? 0} ms`}
            </span>
            <span className="truncate font-mono text-xs text-text-3">GET {call.path}</span>
            <span className="tnum text-xs text-text-3">{call.resultCount ?? 0} results</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
