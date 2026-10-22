"use client"

import type { NajimiTools } from "@najimi/agent"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { BuildSteps } from "@/components/business/build-steps"

/*
 * A business plan Najimi started in the chat: each step as it's built, then the way into the plan.
 */

type Output = NajimiTools["businessPlan"]["output"]

export function BusinessCard({ output }: { output: Output }) {
  const t = useTranslations("Cards")
  const [done, setDone] = useState(false)
  if (!output.businessId)
    return <p className="rounded-card bg-card px-4 py-3 text-sm text-text-2">{output.note}</p>
  return (
    <section className="dark flex flex-col gap-3 rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
        {t("businessBuilding", { name: output.name })}
      </span>
      <BuildSteps runId={output.runId} onDone={() => setDone(true)} />
      <Link
        href={`/business/${output.businessId}`}
        className="flex h-11 items-center justify-center gap-2 rounded-pill bg-foreground text-[14px] font-semibold text-background aria-disabled:opacity-60"
        aria-disabled={!done}
      >
        {t("businessOpen")} <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
