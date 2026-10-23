"use client"

import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link2, Loader2, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgent, useReportScreen } from "@/components/agent/agent-context"
import { Tip } from "@/components/tip"
import type { BusinessView } from "@/lib/business"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { BuildSteps } from "./build-steps"
import { PlanView } from "./plan-view"

/*
 * Your business's page: while the plan builds, every step as Najimi does it; then the plan, with
 * a link to share it, a fresh build, and Najimi to talk it through.
 */

const round =
  "grid size-10 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70 disabled:opacity-60"

export function BusinessPage({ initial }: { initial: BusinessView }) {
  const t = useTranslations("Business")
  const queryClient = useQueryClient()
  const agent = useAgent()
  const [busy, setBusy] = useState(false)
  const query = useQuery({
    queryKey: ["business", initial.id],
    queryFn: () =>
      api<{ business: BusinessView }>(`/api/businesses/${initial.id}`).then((r) => r.business),
    initialData: initial,
  })
  const b = query.data
  useReportScreen({ where: "business plan", label: `the plan for ${b.name}, a ${b.kind}` })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["business", initial.id] })

  const share = async () => {
    try {
      const { token } = await api<{ token: string }>(`/api/businesses/${b.id}/share`, { json: {} })
      const url = `${window.location.origin}/b/${token}`
      if (navigator.share) await navigator.share({ title: b.name, url }).catch(() => undefined)
      else {
        await navigator.clipboard.writeText(url)
        toast(t("linkCopied"))
      }
      void refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    }
  }
  const rebuild = async () => {
    setBusy(true)
    try {
      await api(`/api/businesses/${b.id}/rebuild`, { json: {} })
      sound("promote")
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(false)
    }
  }

  if (b.status !== "ready" || !b.report)
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="font-title text-[2.4rem] leading-none">{b.name}</h1>
          <span className="text-[14px] text-text-3">
            {[b.kind, b.city].filter(Boolean).join(" · ")}
          </span>
        </header>
        <BuildSteps
          runId={b.runId}
          onDone={(ok) => {
            if (ok) sound("promote")
            void refresh()
          }}
        />
        {b.status === "failed" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void rebuild()}
            className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />}
            {t("tryAgain")}
          </button>
        ) : null}
      </div>
    )

  return (
    <PlanView
      business={{ ...b, report: b.report }}
      owner
      actions={
        <>
          <Tip label={t("share")}>
            <button
              type="button"
              aria-label={t("share")}
              onClick={() => void share()}
              className={round}
            >
              <Link2 className="size-4" />
            </button>
          </Tip>
          <Tip label={t("rebuild")}>
            <button
              type="button"
              aria-label={t("rebuild")}
              disabled={busy}
              onClick={() => void rebuild()}
              className={round}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </button>
          </Tip>
          <Tip label={t("ask")}>
            <button
              type="button"
              aria-label={t("ask")}
              onClick={() => agent.ask(t("askAbout", { name: b.name }))}
              className={round}
            >
              <Orb size={22} />
            </button>
          </Tip>
        </>
      }
    />
  )
}
