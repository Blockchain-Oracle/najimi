import { fail, json, withSession } from "@/lib/api"
import { joinCircle } from "@/lib/chat/join"
import { selfOf } from "@/lib/people"

/** Joins a circle by its invite link. */
export async function POST(_: Request, ctx: RouteContext<"/api/join/[token]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const self = await selfOf(auth.session.user.id)
  if (!self) return fail("Pick a few loves first", 409)
  const chatId = await joinCircle((await ctx.params).token, auth.session.user.id, self.name)
  if (!chatId) return fail("That invite isn't valid any more", 404)
  return json({ chatId })
}
