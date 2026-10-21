"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
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
}

/** Request parameters worth showing (the rest is plumbing). */
const SHOWN = [
  "filter.type",
  "filter.tag.types",
  "filter.location.query",
  "filter.tags",
  "query",
  "types",
  "body",
]

/** What one Qloo call asked and how it answered: the request only, never the response body. */
export function CallDetails({ callId }: { callId: string }) {
  const t = useTranslations("Evidence")
  const { data, error, isPending } = useQuery({
    queryKey: qk.qlooCall(callId),
    queryFn: () => api<{ call: Call }>(`/api/qloo-calls/${callId}`),
    staleTime: Number.POSITIVE_INFINITY,
  })
  if (isPending) return <p className="text-xs text-white/60">{t("loading")}</p>
  if (error || !data) return <p className="text-xs text-white/60">{t("unavailable")}</p>
  const call = data.call
  const method = call.params.body ? "POST" : "GET"
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs" dir="ltr">
      <dt className="text-white/55">{t("endpoint")}</dt>
      <dd className="font-mono break-all">
        {method} {call.path}
      </dd>
      {SHOWN.filter((k) => call.params[k]).map((k) => (
        <div key={k} className="contents">
          <dt className="text-white/55">{k === "body" ? t("signal") : k}</dt>
          <dd className="max-h-28 overflow-auto font-mono break-all">{call.params[k]}</dd>
        </div>
      ))}
      <dt className="text-white/55">{t("answer")}</dt>
      <dd className="tnum">
        {call.status ?? "—"} · {t("results", { count: call.resultCount ?? 0 })} ·{" "}
        {call.cacheHit ? t("fromCache") : t("ms", { ms: call.ms ?? 0 })}
      </dd>
    </dl>
  )
}
