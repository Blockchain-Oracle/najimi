import { topic } from "@najimi/live"
import { NextResponse } from "next/server"
import { isMember } from "@/lib/chat/store"
import { streamTopic } from "@/lib/live-stream"
import { getSession } from "@/lib/session"

/** A room, live: every message as it's written or changes, and Najimi's status. Members only. */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]/live">) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const { id } = await ctx.params
  if (!(await isMember(id, session.user.id)))
    return NextResponse.json({ error: "Unknown room" }, { status: 404 })
  return streamTopic(request, topic.room(id))
}
