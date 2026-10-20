import { LIVE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { eventsAfter } from "@najimi/live"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { watchRun } from "@/lib/live-hub"
import { getSession } from "@/lib/session"

/**
 * A run's steps, live (plan §4.6): Server-Sent Events, replayed from Last-Event-ID after a dropped
 * connection, so a page never misses or repeats a step. Only the run's owner may watch it.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/runs/[runId]/events">) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const runId = z.uuid().safeParse((await ctx.params).runId).data
  if (!runId) return NextResponse.json({ error: "Unknown run" }, { status: 404 })
  const [run] = await db
    .select({ id: schema.runs.id })
    .from(schema.runs)
    .where(and(eq(schema.runs.id, runId), eq(schema.runs.ownerId, session.user.id)))
  if (!run) return NextResponse.json({ error: "Unknown run" }, { status: 404 })

  const url = new URL(request.url)
  let last = Number(request.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0) || 0
  const encoder = new TextEncoder()
  let closed = false
  let stop: (() => void) | undefined
  let ping: ReturnType<typeof setInterval> | undefined
  let reading: Promise<void> = Promise.resolve()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (closed) return
        closed = true
        clearInterval(ping)
        stop?.()
        try {
          controller.close()
        } catch {}
      }
      // Reads are chained so events always go out in id order, once each.
      const catchUp = () => {
        reading = reading.then(async () => {
          if (closed) return
          for (const event of await eventsAfter(runId, last)) {
            if (closed) return
            last = event.id
            controller.enqueue(
              encoder.encode(
                `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({ ...event.data, at: event.createdAt })}\n\n`,
              ),
            )
          }
        })
      }
      request.signal.addEventListener("abort", close)
      // Listen first, then replay: nothing that happens in between is missed.
      stop = await watchRun(runId, { onNotice: catchUp, onReconnect: catchUp })
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
