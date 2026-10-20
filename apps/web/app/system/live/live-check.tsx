"use client"

import { Button } from "@najimi/ui/components/button"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"

type Step = { id: string; type: string; data: Record<string, unknown> }

export function LiveCheck() {
  const [steps, setSteps] = useState<Step[]>([])
  const [busy, setBusy] = useState(false)
  const done = steps.some((s) => s.type === "status" && s.data.status === "done")

  async function run() {
    setBusy(true)
    setSteps([])
    const session = await authClient.getSession()
    if (!session.data) await authClient.signIn.anonymous()
    const response = await fetch("/api/system/live-check", { method: "POST" })
    const { runId } = (await response.json()) as { runId: string }
    const source = new EventSource(`/api/runs/${runId}/events`)
    const take = (type: string) => (event: MessageEvent) => {
      const data = JSON.parse(event.data) as Record<string, unknown>
      setSteps((prev) => [...prev, { id: event.lastEventId, type, data }])
      if (type === "status" && (data.status === "done" || data.status === "failed")) {
        source.close()
        setBusy(false)
      }
    }
    source.addEventListener("step", take("step"))
    source.addEventListener("status", take("status"))
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
