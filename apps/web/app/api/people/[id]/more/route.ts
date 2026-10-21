import { TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { type Domain, type Love, profilePicks } from "@najimi/qloo"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { ownedPerson } from "@/lib/people"

const query = z.object({
  domain: z.enum(TASTE_DOMAINS.map((d) => d.key) as [Domain, ...Domain[]]),
  seed: z.string().min(8).max(64),
  name: z.string().max(200).default("this"),
})

/**
 * "More like this" (rule 3): the person's taste with this pick as its loudest love, in the same
 * domain, minus what they've already seen or turned down.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/people/[id]/more">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const person = await ownedPerson(auth.session.user.id, (await ctx.params).id)
  if (!person) return fail("Unknown person", 404)
  const url = new URL(request.url)
  const input = query.safeParse(Object.fromEntries(url.searchParams))
  if (!input.success) return fail("That doesn't look right", 400)
  const rows = await db.select().from(schema.loves).where(eq(schema.loves.personId, person.id))
  const loves: Love[] = [
    ...rows.map((r) => ({ qlooId: r.qlooId, name: r.name, weight: r.weight })),
    { qlooId: input.data.seed, name: input.data.name, weight: 10 },
  ]
  const result = await profilePicks(
    loves,
    input.data.domain,
    { city: person.city, exclude: [...person.excludedIds, input.data.seed], take: 8 },
    { userId: auth.session.user.id, purpose: `More like ${input.data.name}` },
  )
  return json({ picks: result.picks })
}
