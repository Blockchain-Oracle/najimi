import { liveCall, markNajimi } from "@najimi/agent/server"
import { fail, json, withSession } from "@/lib/api"
import { isMember } from "@/lib/chat/store"
import { dispatchNajimi } from "@/lib/livekit"

type Params = { params: Promise<{ id: string }> }

/** Brings Najimi into this chat's call: it listens, and answers when someone says its name. */
export async function POST(_: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chatId = (await params).id
  const me = auth.session.user.id
  if (!(await isMember(chatId, me))) return fail("Not your chat", 404)
  const call = await liveCall(chatId)
  if (!call) return fail("There's no call going in this chat", 409)
  if (!call.najimi) {
    await dispatchNajimi(call)
    await markNajimi(call.id)
  }
  return json({ ok: true })
}
