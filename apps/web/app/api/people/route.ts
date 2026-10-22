import { TASTE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { peopleOf, selfOf, startTasteRun } from "@/lib/people"
import { loveInput, personInput } from "@/lib/schemas"

const createInput = personInput.extend({
  isSelf: z.boolean().default(false),
  loves: z.array(loveInput).min(1).max(TASTE.lovesMax),
})

export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  return json({ people: await peopleOf(auth.session.user.id) })
}

/**
 * A new taste profile: me (onboarding) or someone I make for. Their loves are saved and the taste
 * starts computing at once; the reveal watches the returned run.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, createInput)
  if ("error" in parsed) return parsed.error
  const userId = auth.session.user.id
  const input = parsed.data
  if (input.isSelf && (await selfOf(userId))) return fail("You already have a profile", 409)

  const person = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.people)
      .values({
        ownerId: userId,
        isSelf: input.isSelf,
        name: input.name,
        city: input.city || null,
        cityLat: input.city ? (input.cityLat ?? null) : null,
        cityLon: input.city ? (input.cityLon ?? null) : null,
        look: input.look ?? null,
        locale: input.locale ?? null,
      })
      .returning()
    if (!row) throw new Error("Couldn't save the profile")
    const unique = [...new Map(input.loves.map((l) => [l.qlooId, l])).values()]
    await tx.insert(schema.loves).values(
      unique.map((l) => ({
        personId: row.id,
        qlooId: l.qlooId,
        type: l.type,
        name: l.name,
        imageUrl: l.image ?? null,
        weight: l.weight,
      })),
    )
    if (input.isSelf) {
      await tx
        .insert(schema.userPrefs)
        .values({ userId, locale: input.locale ?? null, onboardedAt: new Date() })
        .onConflictDoUpdate({
          target: schema.userPrefs.userId,
          set: { onboardedAt: new Date(), ...(input.locale ? { locale: input.locale } : {}) },
        })
    }
    return row
  })
  const runId = await startTasteRun(userId, person.id)
  return json({ personId: person.id, runId })
}
