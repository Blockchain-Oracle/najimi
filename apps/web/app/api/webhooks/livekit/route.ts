import { endCall } from "@najimi/agent/server"
import { fail, json } from "@/lib/api"
import { livekitWebhooks } from "@/lib/livekit"

/** LiveKit's own word that a call's room has closed (everyone left): its card says it ended. */
export async function POST(request: Request) {
  const body = await request.text()
  let event: Awaited<ReturnType<ReturnType<typeof livekitWebhooks>["receive"]>>
  try {
    event = await livekitWebhooks().receive(body, request.headers.get("authorization") ?? undefined)
  } catch {
    return fail("Bad signature", 401)
  }
  if (event.event === "room_finished" && event.room?.name?.startsWith("najimi-"))
    await endCall(event.room.name)
  return json({ ok: true })
}
