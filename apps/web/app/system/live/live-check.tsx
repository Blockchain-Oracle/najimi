"use client"

import { Button } from "@najimi/ui/components/button"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { useRunEvents } from "@/lib/use-run"

export function LiveCheck() {
  const [runId, setRunId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const { events: steps, status } = useRunEvents(runId)
  const done = status === "done"
  const busy = starting || (runId !== null && status !== "done" && status !== "failed")

  async function run() {
    setStarting(true)
    setRunId(null)
    const session = await authClient.getSession()
    if (!session.data) await authClient.signIn.anonymous()
    const response = await fetch("/api/system/live-check", { method: "POST" })
    const { runId: id } = (await response.json()) as { runId: string }
    setRunId(id)
    setStarting(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={run} disabled={busy}>
        {busy ? "Running…" : "Run the live check"}
      </Button>
      <ol className="flex flex-col gap-1 text-sm tnum">
        {steps.map((s) => (
          <li key={s.id} className="flex justify-between border-b border-border py-2">
            <span>
              {s.type === "step" ? String(s.data.step) : `status: ${String(s.data.status)}`}
            </span>
            <span className="text-text-3">#{s.id}</span>
          </li>
        ))}
      </ol>
      {done ? (
        <p className="rounded-card bg-confirm px-4 py-3 text-sm font-bold uppercase text-confirm-foreground">
          Every step arrived live
        </p>
      ) : null}
    </div>
  )
}
