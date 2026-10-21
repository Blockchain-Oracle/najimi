import { TASTE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { count, eq } from "drizzle-orm"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson, startTasteRun } from "@/lib/people"
import { loveInput } from "@/lib/schemas"

/** Adds a love; the taste recomputes. */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/loves">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, loveInput)
  if ("error" in parsed) return parsed.error
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(schema.loves)
    .where(eq(schema.loves.personId, person.id))
  if (n >= TASTE.lovesMax) return fail(`Up to ${TASTE.lovesMax} loves`, 400)
  const l = parsed.data
  await db
    .insert(schema.loves)
    .values({
      personId: person.id,
      qlooId: l.qlooId,
      type: l.type,
      name: l.name,
      imageUrl: l.image ?? null,
      weight: l.weight,
    })
    .onConflictDoNothing()
  return json({ runId: await startTasteRun(auth.session.user.id, person.id) })
}
