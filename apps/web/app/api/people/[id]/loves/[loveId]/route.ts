import { TASTE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { and, count, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson, startTasteRun } from "@/lib/people"

async function owned(userId: string, personId: string, loveId: string) {
  const person = await ownedPerson(userId, personId)
  if (!person || !z.uuid().safeParse(loveId).success) return null
  const [love] = await db
    .select()
    .from(schema.loves)
    .where(and(eq(schema.loves.id, loveId), eq(schema.loves.personId, person.id)))
  return love ? { person, love } : null
}

/** How much a love counts (the weight slider); the taste recomputes. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/people/[id]/loves/[loveId]">,
) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id, loveId } = await ctx.params
  const found = await owned(auth.session.user.id, id, loveId)
  if (!found) return fail("Unknown love", 404)
  const parsed = await body(
    request,
    z.object({ weight: z.number().int().min(TASTE.weightMin).max(TASTE.weightMax) }),
  )
  if ("error" in parsed) return parsed.error
  await db
    .update(schema.loves)
    .set({ weight: parsed.data.weight })
    .where(eq(schema.loves.id, found.love.id))
  return json({ runId: await startTasteRun(auth.session.user.id, found.person.id) })
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/people/[id]/loves/[loveId]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id, loveId } = await ctx.params
  const found = await owned(auth.session.user.id, id, loveId)
  if (!found) return fail("Unknown love", 404)
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(schema.loves)
    .where(eq(schema.loves.personId, found.person.id))
  if (n <= 1) return fail("Keep at least one love", 400)
  await db.delete(schema.loves).where(eq(schema.loves.id, found.love.id))
  return json({ runId: await startTasteRun(auth.session.user.id, found.person.id) })
}
