"use client"

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@najimi/ui/components/sheet"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { api } from "@/lib/fetcher"

type CallRow = {
  id: string
  purpose: string | null
  path: string
  params: Record<string, string>
  status: number | null
  ms: number | null
  cacheHit: boolean
  resultCount: number | null
}

/** Every Qloo call behind what's on screen, in order: the proof that it would not work without Qloo. */
export function BuiltOnQloo({ runId }: { runId: string | null }) {
  const t = useTranslations("Taste")
  const te = useTranslations("Evidence")
  const calls = useQuery({
    queryKey: ["run-calls", runId],
    queryFn: () => api<{ calls: CallRow[] }>(`/api/runs/${runId}/qloo-calls`),
    enabled: Boolean(runId),
    staleTime: 30_000,
  })
  if (!runId) return null
  const list = calls.data?.calls ?? []
  return (
    <Sheet>
      <SheetTrigger className="sticker inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold">
        <span className="size-1.5 rounded-full bg-lime" />
        {t("builtOnQloo")}
        {list.length ? (
          <span className="text-white/60 tnum">· {t("callsCount", { count: list.length })}</span>
        ) : null}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto border-0 bg-sticker text-sticker-foreground sm:max-w-md"
      >
        <SheetTitle className="font-title px-5 pt-5 text-[1.75rem] font-normal text-white">
          {t("builtOnQloo")}
        </SheetTitle>
        <ol className="flex flex-col gap-3 px-5 pb-6">
          {list.map((c) => (
            <li key={c.id} className="rounded-tile bg-white/6 p-3 text-xs" dir="ltr">
              <p className="mb-1 text-sm font-semibold">{c.purpose ?? c.path}</p>
              <p className="font-mono break-all text-white/80">
                {c.params.body ? "POST" : "GET"} {c.path}
                {c.params["filter.type"] ? ` · ${c.params["filter.type"]}` : ""}
                {c.params["filter.tag.types"] ? ` · ${c.params["filter.tag.types"]}` : ""}
              </p>
              <p className="mt-1 text-white/55 tnum">
                {c.status ?? "—"} · {te("results", { count: c.resultCount ?? 0 })} ·{" "}
                {c.cacheHit ? te("fromCache") : te("ms", { ms: c.ms ?? 0 })}
              </p>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  )
}
