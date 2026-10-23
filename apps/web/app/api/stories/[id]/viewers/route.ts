import { fail, json, withSession } from "@/lib/api"
import { viewersOf } from "@/lib/stories"

/** Who saw your story, and how they reacted. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Not found", 404)
  const viewers = await viewersOf(id, auth.session.user.id)
  return viewers ? json({ viewers }) : fail("Not found", 404)
}
