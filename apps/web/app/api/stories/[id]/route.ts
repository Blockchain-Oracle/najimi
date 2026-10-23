import { fail, json, withSession } from "@/lib/api"
import { removeStory } from "@/lib/stories"

/** Takes your story down. */
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Not found", 404)
  return (await removeStory(id, auth.session.user.id)) ? json({ ok: true }) : fail("Not found", 404)
}
