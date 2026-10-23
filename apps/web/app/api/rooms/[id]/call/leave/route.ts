import { fail, json, withSession } from "@/lib/api"
import { isMember } from "@/lib/chat/store"
import { callsReady, leaveCall } from "@/lib/livekit"

type Params = { params: Promise<{ id: string }> }

/** You left the call (or closed the page): if you were the last one there, it ends now. */
export async function POST(_: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!callsReady()) return json({ ok: true })
  const chatId = (await params).id
  const me = auth.session.user.id
  if (!(await isMember(chatId, me))) return fail("Not your chat", 404)
  const call = await leaveCall(chatId, me)
  return json({ ok: true, ended: Boolean(call?.endedAt) })
}
