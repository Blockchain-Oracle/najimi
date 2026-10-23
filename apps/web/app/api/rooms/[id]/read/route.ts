import { fail, json, withSession } from "@/lib/api"
import { markRead, ownedChat } from "@/lib/chat/store"

/** They've read the room up to now (their unread count in Chats goes back to zero). */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  await markRead(auth.session.user.id, chat.id)
  return json({ ok: true })
}
