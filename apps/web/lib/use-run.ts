"use client"

import { useEffect, useRef, useState } from "react"

export type RunEvent = { id: number; type: string; data: Record<string, unknown> }
export type RunStatus = "queued" | "running" | "waiting" | "done" | "failed" | "cancelled"

/**
 * A run's events, live (plan §4.6): EventSource replays from Last-Event-ID on reconnect, so the
 * list is complete and in order. `onEvent` lets a page refresh the data an event changed.
 */
export function useRunEvents(
  runId: string | null | undefined,
  onEvent?: (event: RunEvent) => void,
) {
  const [events, setEvents] = useState<RunEvent[]>([])
  const [status, setStatus] = useState<RunStatus>("queued")
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!runId) return
    setEvents([])
    const source = new EventSource(`/api/runs/${runId}/events`)
    const take = (type: string) => (message: MessageEvent<string>) => {
      const event: RunEvent = {
        id: Number(message.lastEventId),
        type,
        data: JSON.parse(message.data),
      }
      setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]))
      if (type === "status") {
        const next = event.data.status as RunStatus
        setStatus(next)
        if (next === "done" || next === "failed" || next === "cancelled") source.close()
      }
      handler.current?.(event)
    }
    for (const type of ["step", "section", "status"]) source.addEventListener(type, take(type))
    return () => source.close()
  }, [runId])

  return { events, status }
}
