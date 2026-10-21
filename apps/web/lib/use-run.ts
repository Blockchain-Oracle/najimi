"use client"

import { useEffect, useRef, useState } from "react"

export type RunEvent = { id: number; type: string; data: Record<string, unknown>; at: string }
export type RunStatus = "queued" | "running" | "waiting" | "done" | "failed" | "cancelled"

const FINISHED: RunStatus[] = ["done", "failed", "cancelled"]

/**
 * A run's events, live: EventSource replays from Last-Event-ID on reconnect, so the list is
 * complete and in order. Every event type arrives (progress, asset, status…); `onEvent` lets a card
 * refresh the data an event changed.
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
    source.onmessage = (message: MessageEvent<string>) => {
      const parsed = JSON.parse(message.data) as Omit<RunEvent, "id">
      const event: RunEvent = { ...parsed, id: Number(message.lastEventId) }
      setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]))
      if (event.type === "status") {
        const next = event.data.status as RunStatus
        setStatus(next)
        if (FINISHED.includes(next)) source.close()
      }
      handler.current?.(event)
    }
    return () => source.close()
  }, [runId])

  return { events, status }
}
