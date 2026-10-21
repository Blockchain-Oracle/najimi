import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson } from "@/lib/people"
import { pickInput } from "@/lib/schemas"

/** Keeps a pick on this person's list (rule 3: any domain). */
export async function POST(request: Request, ctx: RouteContext<"/api/people/[id]/saved">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, pickInput)
  if ("error" in parsed) return parsed.error
  const p = parsed.data
  await db
    .insert(schema.savedPicks)
    .values({
      personId: person.id,
      qlooId: p.qlooId,
      type: p.type,
      name: p.name,
      imageUrl: p.image ?? null,
    })
    .onConflictDoNothing()
  return json({ ok: true })
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/people/[id]/saved">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, z.object({ qlooId: z.string().min(8).max(64) }))
  if ("error" in parsed) return parsed.error
  await db
    .delete(schema.savedPicks)
    .where(
      and(
        eq(schema.savedPicks.personId, person.id),
        eq(schema.savedPicks.qlooId, parsed.data.qlooId),
      ),
    )
  return json({ ok: true })
}
