import { startCall } from "@najimi/agent/server"
import { fail, json, withSession } from "@/lib/api"
import { isMember } from "@/lib/chat/store"
import { callsReady, callToken, openCall } from "@/lib/livekit"
import { selfOf } from "@/lib/people"

type Params = { params: Promise<{ id: string }> }

/** Starts this chat's call, or joins the one going: a member gets a signed pass into its room. */
export async function POST(_: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!callsReady()) return fail("Calls aren't switched on yet", 503)
  const chatId = (await params).id
  const me = auth.session.user
  if (!(await isMember(chatId, me.id))) return fail("Not your chat", 404)
  // Their name as everyone knows it here (a guest's account name is a placeholder).
  const name = (await selfOf(me.id))?.name || me.name || "Someone"
  const call = await startCall(chatId, me.id, name)
  const pass = await callToken(call.room, me.id, name)
  return json({ call: { id: call.id, room: call.room, najimi: call.najimi }, ...pass })
}

/** Whether calls are on here, and this chat's call if one is going (for the header and card). */
export async function GET(_: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chatId = (await params).id
  if (!(await isMember(chatId, auth.session.user.id))) return fail("Not your chat", 404)
  const call = callsReady() ? await openCall(chatId) : null
  return json({ ready: callsReady(), live: call ? { id: call.id, najimi: call.najimi } : null })
}
