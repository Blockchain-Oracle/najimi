import { fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"
import { allow } from "@/lib/rate-limit"
import { soundtrackOf } from "@/lib/soundtrack"

/** The circle's soundtrack: songs from everyone's taste blended, for the one player. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  const chat = await ownedChat(userId, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  if (!allow(`soundtrack:${userId}`, 10, 60_000)) return fail("Slow down a little", 429)
  return json({ tracks: await soundtrackOf(chat.id, userId) })
}
