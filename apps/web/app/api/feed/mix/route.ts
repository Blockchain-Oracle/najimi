import { FEED } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { FEED_DOMAINS, mixOf } from "@/lib/feed-shared"
import { selfOf } from "@/lib/people"

const input = z.object({
  mix: z.partialRecord(
    z.enum(FEED_DOMAINS as [string, ...string[]]),
    z.number().int().min(0).max(FEED.mixMax),
  ),
})

/** The feed's dials: how much of each category it shows. The feed starts over with the new mix. */
export async function PUT(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const self = await selfOf(auth.session.user.id)
  if (!self) return fail("Pick a few loves first", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const mix = mixOf({ ...mixOf(self.feedMix), ...parsed.data.mix })
  if (!Object.values(mix).some((v) => v > 0)) return fail("Keep at least one thing on", 400)
  await db
    .update(schema.people)
    .set({ feedMix: mix, feedCursor: null })
    .where(eq(schema.people.id, self.id))
  return json({ mix })
}
