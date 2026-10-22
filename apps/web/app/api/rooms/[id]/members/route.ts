import { fail, json, withSession } from "@/lib/api"
import { membersOf, ownedChat } from "@/lib/chat/store"

/** Who's in the room, and (for a circle) its invite link. */
export async function GET(_: Request, ctx: RouteContext<"/api/rooms/[id]/members">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  return json({
    members: await membersOf(chat.id),
    invite: chat.kind === "circle" && chat.inviteToken ? `/join/${chat.inviteToken}` : null,
  })
}
