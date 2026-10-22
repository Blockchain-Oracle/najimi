import { topic } from "@najimi/live"
import { NextResponse } from "next/server"
import { streamTopic } from "@/lib/live-stream"
import { getSession } from "@/lib/session"

/** Your own news, live (a follow, a circle invite, a message): only ever yours. */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  return streamTopic(request, topic.user(session.user.id))
}
