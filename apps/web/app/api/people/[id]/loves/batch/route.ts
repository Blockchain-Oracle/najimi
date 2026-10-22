import { TASTE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { count, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedPerson, startTasteRun } from "@/lib/people"
import { loveInput } from "@/lib/schemas"

const input = z.object({ loves: z.array(loveInput).min(1).max(TASTE.seedsMax) })

/**
 * Adds what someone kept from an import in one go (up to a taste's full size), then the taste
 * recomputes once, not once per love.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(schema.loves)
    .where(eq(schema.loves.personId, person.id))
  const room = Math.max(0, TASTE.seedsMax - n)
  if (!room) return fail(`Your taste is full (${TASTE.seedsMax} loves); remove some first`, 400)
  const adding = parsed.data.loves.slice(0, room)
  const added = await db
    .insert(schema.loves)
    .values(
      adding.map((l) => ({
        personId: person.id,
        qlooId: l.qlooId,
        type: l.type,
        name: l.name,
        imageUrl: l.image ?? null,
        weight: l.weight,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.loves.id })
  return json({
    added: added.length,
    runId: added.length ? await startTasteRun(auth.session.user.id, person.id) : null,
  })
}
