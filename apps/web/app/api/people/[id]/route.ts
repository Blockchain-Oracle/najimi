import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson, startTasteRun } from "@/lib/people"
import { personInput } from "@/lib/schemas"

/** Edits who someone is (name, city, language, age, constraints). A new city recomputes places. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, personInput.partial())
  if ("error" in parsed) return parsed.error
  const input = parsed.data
  await db
    .update(schema.people)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.ageBand !== undefined ? { ageBand: input.ageBand } : {}),
      ...(input.constraints !== undefined ? { constraints: input.constraints } : {}),
    })
    .where(eq(schema.people.id, person.id))
  const cityChanged = input.city !== undefined && (input.city || null) !== person.city
  const runId = cityChanged ? await startTasteRun(auth.session.user.id, person.id) : null
  return json({ ok: true, runId })
}

/** Removes someone I make for (never "me": that's "delete all my data" in settings). */
export async function DELETE(_: Request, ctx: RouteContext<"/api/people/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  if (person.isSelf) return fail("You can't remove yourself here", 400)
  await db.delete(schema.people).where(eq(schema.people.id, person.id))
  return json({ ok: true })
}
