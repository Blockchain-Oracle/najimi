import { db, schema } from "@najimi/db"
import { topic } from "@najimi/live"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"
import { isMember } from "@/lib/chat/store"
import { streamTopic } from "@/lib/live-stream"
import { getSession } from "@/lib/session"

/**
 * A run's events, live (the taste reveal, a picture being made). Its owner may watch, and so may
 * anyone in the room it was started from.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/runs/[runId]/events">) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const runId = z.uuid().safeParse((await ctx.params).runId).data
  if (!runId) return NextResponse.json({ error: "Unknown run" }, { status: 404 })
  const [run] = await db
    .select({ ownerId: schema.runs.ownerId, chatId: schema.runs.chatId })
    .from(schema.runs)
    .where(and(eq(schema.runs.id, runId)))
  const allowed =
    run &&
    (run.ownerId === session.user.id ||
      (run.chatId ? await isMember(run.chatId, session.user.id) : false))
  if (!allowed) return NextResponse.json({ error: "Unknown run" }, { status: 404 })
  return streamTopic(request, topic.run(runId))
}
