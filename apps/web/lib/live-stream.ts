import "server-only"
import { LIVE } from "@najimi/config"
import { eventsAfter, lastEventId } from "@najimi/live"
import { watch } from "@/lib/live-hub"

/**
 * A topic's events as Server-Sent Events, replayed from Last-Event-ID (or `?after=`) after a
 * dropped connection, so a page never misses or repeats one. Each event is a plain message carrying
 * its own type. The caller has already checked the viewer may watch this topic.
 */
export function streamTopic(request: Request, name: string): Response {
  const url = new URL(request.url)
  const from = request.headers.get("last-event-id") ?? url.searchParams.get("after")
  let last = Number(from ?? 0) || 0
  const encoder = new TextEncoder()
  let closed = false
  let stop: (() => void) | undefined
  let ping: ReturnType<typeof setInterval> | undefined
  let reading: Promise<void> = Promise.resolve()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // `?after=now`: only what happens from here on (an incoming-call alert, not old news).
      if (from === "now") last = await lastEventId(name)
      const close = () => {
        if (closed) return
        closed = true
        clearInterval(ping)
        stop?.()
        try {
          controller.close()
        } catch {}
      }
      // Reads are chained so events go out in id order, once each; a long backlog is read in
      // pages until it is drained.
      const catchUp = () => {
        reading = reading.then(async () => {
          for (;;) {
            if (closed) return
            const batch = await eventsAfter(name, last)
            for (const event of batch) {
              if (closed) return
              last = event.id
              const payload = { type: event.type, data: event.data, at: event.createdAt }
              controller.enqueue(
                encoder.encode(`id: ${event.id}\ndata: ${JSON.stringify(payload)}\n\n`),
              )
            }
            if (batch.length < LIVE.replayMax) return
          }
        })
      }
      request.signal.addEventListener("abort", close)
      // Listen first, then replay: nothing that happens in between is missed.
      stop = await watch(name, { onNotice: catchUp, onReconnect: catchUp })
      catchUp()
      ping = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"))
      }, LIVE.pingMs)
    },
    cancel() {
      closed = true
      clearInterval(ping)
      stop?.()
    },
  })
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
