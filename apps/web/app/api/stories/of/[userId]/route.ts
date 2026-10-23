import { fail, json, withSession } from "@/lib/api"
import { storiesOf } from "@/lib/stories"

/** Someone's stories, if their taste is yours to see. */
export async function GET(_: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { userId } = await ctx.params
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(userId)) return fail("Not found", 404)
  const stories = await storiesOf(userId, auth.session.user.id)
  return stories ? json({ stories }) : fail("Not found", 404)
}
