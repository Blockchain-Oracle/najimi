import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson } from "@/lib/people"

const input = z.object({ qlooId: z.string().min(8).max(64) })

/**
 * "Not for me" (rule 3): the pick leaves this person's taste page at once and is excluded from
 * every later Qloo call made for them. DELETE takes it back.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/not-for-me">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const { qlooId } = parsed.data
  await db.transaction(async (tx) => {
    await tx
      .update(schema.people)
      .set({
        excludedIds: sql`array_append(array_remove(${schema.people.excludedIds}, ${qlooId}), ${qlooId})`,
      })
      .where(eq(schema.people.id, person.id))
    const [taste] = await tx
      .select()
      .from(schema.tastes)
      .where(eq(schema.tastes.personId, person.id))
    if (taste?.picks) {
      const picks: Record<string, StoredPick[]> = Object.fromEntries(
        Object.entries(taste.picks).map(([d, list]) => [
          d,
          list.filter((p) => p.qlooId !== qlooId),
        ]),
      )
      await tx.update(schema.tastes).set({ picks }).where(eq(schema.tastes.personId, person.id))
    }
  })
  return json({ ok: true })
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/people/[id]/not-for-me">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  await db
    .update(schema.people)
    .set({ excludedIds: sql`array_remove(${schema.people.excludedIds}, ${parsed.data.qlooId})` })
    .where(eq(schema.people.id, person.id))
  return json({ ok: true })
}
