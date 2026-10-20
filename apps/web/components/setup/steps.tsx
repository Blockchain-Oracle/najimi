"use client"

import { cn } from "@najimi/ui/lib/utils"
import { Check, Loader } from "lucide-react"
import type { RunEvent, RunStatus } from "@/lib/use-run"

const PLANNED = [
  { key: "home", label: "Opening your site" },
  { key: "map", label: "Finding your pages" },
  { key: "pages", label: "Reading them" },
  { key: "profile", label: "Noting what you say about yourself" },
  { key: "qloo", label: "Finding you in Qloo" },
] as const

/** Which planned step an event finishes (variants like "qloo-confirm" finish their base step). */
const baseKey = (key: string) => key.replace(/-(basic|confirm|unavailable)$/, "")

/**
 * The live setup steps (design: Lemni/Manychat "reading your page" → the step resolves into what
 * it found). Done steps show what was found; the next one turns while the run works.
 */
export function SetupSteps({ events, status }: { events: RunEvent[]; status: RunStatus }) {
  const done = new Map<string, string>()
  for (const e of events) {
    if (e.type !== "step") continue
    const key = baseKey(String(e.data.key))
    if (PLANNED.some((p) => p.key === key)) done.set(key, String(e.data.label))
  }
  const failed = status === "failed"
  const error = [...events].reverse().find((e) => e.type === "status" && e.data.error)?.data.error
  let activeShown = false
  return (
    <ol className="flex flex-col">
      {PLANNED.map((step) => {
        const label = done.get(step.key)
        const isActive = !label && !activeShown && (status === "running" || status === "queued")
        if (isActive) activeShown = true
        return (
          <li key={step.key} className="flex items-start gap-3 border-b border-border py-3 text-sm">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {label ? (
                <Check className="size-4" aria-hidden />
              ) : isActive ? (
                <Loader className="size-4 animate-spin text-text-3" aria-hidden />
              ) : (
                <span className="size-1.5 rounded-full bg-border" aria-hidden />
              )}
            </span>
            <span className={cn(label ? "text-foreground" : "text-text-3")}>
              {label ?? step.label}
            </span>
          </li>
        )
      })}
      {failed ? (
        <li className="mt-3 rounded-card bg-foreground px-4 py-3 text-sm text-background">
          {String(error ?? "We couldn't read this site")}
        </li>
      ) : null}
    </ol>
  )
}
