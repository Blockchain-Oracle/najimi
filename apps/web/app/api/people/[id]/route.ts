import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson, startTasteRun } from "@/lib/people"
import { personInput } from "@/lib/schemas"

/** Edits who someone is (name, city, language). A new city recomputes places. */
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
      ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    })
    .where(eq(schema.people.id, person.id))
  const cityChanged = input.city !== undefined && (input.city || null) !== person.city
  const runId = cityChanged ? await startTasteRun(auth.session.user.id, person.id) : null
  return json({ ok: true, runId })
}
