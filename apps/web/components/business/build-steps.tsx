"use client"

import { useTranslations } from "next-intl"
import { type Task, TaskList } from "@/components/connect/task-list"
import { useRunEvents } from "@/lib/use-run"

/*
 * A plan being built, step by step as the worker does it: the site, the business in Qloo, its fans,
 * where they are, the street, what's rising, the plan. Each step carries what it found.
 */

const STEPS = ["site", "match", "fans", "areas", "scene", "rising", "plan"] as const

export function BuildSteps({
  runId,
  onDone,
}: {
  runId: string | null
  onDone?: (ok: boolean) => void
}) {
  const t = useTranslations("Business")
  const { events } = useRunEvents(runId, (e) => {
    if (e.type !== "status") return
    if (e.data.status === "done") onDone?.(true)
    if (e.data.status === "failed") onDone?.(false)
  })
  const state = new Map<string, { status: string; note: string | null }>()
  for (const e of events)
    if (e.type === "step")
      state.set(String(e.data.step), {
        status: String(e.data.status),
        note: (e.data.note as string | null) ?? null,
      })
  const failed = events.find((e) => e.type === "status" && e.data.status === "failed")
  const tasks: Task[] = STEPS.filter((id) => state.get(id)?.status !== "skipped").map((id) => {
    const s = state.get(id)
    return {
      id,
      label: t(`step.${id}`),
      note: s?.note ?? null,
      status: s?.status === "done" ? "done" : s?.status === "running" ? "running" : "pending",
    }
  })
  return (
    <div className="flex flex-col gap-2">
      <TaskList tasks={tasks} label={t("building")} />
      {failed ? (
        <p className="text-[13px] text-danger">{String(failed.data.error ?? t("failed"))}</p>
      ) : null}
    </div>
  )
}
