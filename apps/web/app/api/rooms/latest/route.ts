import { randomUUID } from "node:crypto"
import { roomMessages } from "@najimi/agent/server"
import { ROOMS } from "@najimi/config"
import { lastEventId, topic } from "@najimi/live"
import { json, withSession } from "@/lib/api"
import { chatsOf } from "@/lib/chat/store"

/**
 * Your latest conversation with Najimi, for the sheet on every screen: its messages and where its
 * live stream starts. `?new=1` (or nobody has talked to Najimi yet) gives a fresh room id.
 */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const fresh = new URL(request.url).searchParams.get("new") === "1"
  const [latest] = fresh ? [] : await chatsOf(auth.session.user.id, { limit: 1, kind: "agent" })
  if (!latest)
    return json({ chatId: randomUUID(), title: null, messages: [], status: "idle", after: 0 })
  const after = await lastEventId(topic.room(latest.id))
  return json({
    chatId: latest.id,
    title: latest.title,
    messages: await roomMessages(latest.id, { limit: ROOMS.pageSize }),
    status: latest.status,
    after,
  })
}
