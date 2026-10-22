import { fail, json, withSession } from "@/lib/api"
import { overlapOf, ownedChat } from "@/lib/chat/store"

/** What everyone in a circle shares: loves and taste words. */
export async function GET(_: Request, ctx: RouteContext<"/api/rooms/[id]/overlap">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  return json(await overlapOf(chat.id))
}
