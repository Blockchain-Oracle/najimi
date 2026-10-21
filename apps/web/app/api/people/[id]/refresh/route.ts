import { fail, json, withSession } from "@/lib/api"
import { ownedPerson, startTasteRun } from "@/lib/people"

export async function POST(_: Request, ctx: RouteContext<"/api/people/[id]/refresh">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  return json({ runId: await startTasteRun(auth.session.user.id, person.id) })
}
