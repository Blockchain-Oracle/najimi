import { FEED, TASTE, TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { enqueueDebounced } from "@najimi/jobs"
import { and, asc, count, eq, lte } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { hidePick, selfOf } from "@/lib/people"
import { allow } from "@/lib/rate-limit"

const KINDS = ["seen", "dwell", "play", "love", "unlove", "hide", "save", "unsave", "open"] as const

const signal = z.object({
  qlooId: z.string().min(8).max(64),
  type: z.enum(TASTE_DOMAINS.map((d) => d.type) as [string, ...string[]]),
  kind: z.enum(KINDS),
  value: z
    .number()
    .min(0)
    .max(6 * 60 * 60 * 1000)
    .optional(),
  name: z.string().trim().min(1).max(300).optional(),
  image: z.url().max(2000).nullable().optional(),
  surface: z.enum(["feed", "taste", "graph", "room", "player"]).optional(),
})

const input = z.object({ signals: z.array(signal).min(1).max(FEED.batchMax) })

/**
 * What you did with cards, in batches: every signal is kept (history the graph and the agent
 * read); loves join your taste at a light weight, hides leave it for good, saves keep the pick.
 * A changed taste is recomputed once things settle (debounced), not once per tap.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  if (!allow(`signals:${auth.session.user.id}`, FEED.perMinute, 60_000))
    return fail("Slow down a little", 429)
  const self = await selfOf(auth.session.user.id)
  if (!self) return fail("Pick a few loves first", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const signals = parsed.data.signals

  await db.insert(schema.signals).values(
    signals.map((s) => ({
      personId: self.id,
      qlooId: s.qlooId,
      type: s.type,
      kind: s.kind,
      value: s.value ?? null,
      surface: s.surface ?? "feed",
    })),
  )

  let retune = false
  for (const s of signals) {
    if (s.kind === "love" && s.name) {
      const [{ n } = { n: 0 }] = await db
        .select({ n: count() })
        .from(schema.loves)
        .where(eq(schema.loves.personId, self.id))
      // A full taste makes room by letting go of its oldest light love (one the feed added).
      if (n >= TASTE.seedsMax) {
        const [oldest] = await db
          .select({ id: schema.loves.id })
          .from(schema.loves)
          .where(and(eq(schema.loves.personId, self.id), lte(schema.loves.weight, FEED.loveWeight)))
          .orderBy(asc(schema.loves.createdAt))
          .limit(1)
        if (!oldest) continue
        await db.delete(schema.loves).where(eq(schema.loves.id, oldest.id))
      }
      await db
        .insert(schema.loves)
        .values({
          personId: self.id,
          qlooId: s.qlooId,
          type: s.type,
          name: s.name,
          imageUrl: s.image ?? null,
          weight: FEED.loveWeight,
        })
        .onConflictDoNothing()
      retune = true
    } else if (s.kind === "unlove") {
      await db
        .delete(schema.loves)
        .where(and(eq(schema.loves.personId, self.id), eq(schema.loves.qlooId, s.qlooId)))
      retune = true
    } else if (s.kind === "hide") {
      await hidePick(self.id, s.qlooId)
    } else if (s.kind === "save" && s.name) {
      await db
        .insert(schema.savedPicks)
        .values({
          personId: self.id,
          qlooId: s.qlooId,
          type: s.type,
          name: s.name,
          imageUrl: s.image ?? null,
        })
        .onConflictDoNothing()
    } else if (s.kind === "unsave") {
      await db
        .delete(schema.savedPicks)
        .where(and(eq(schema.savedPicks.personId, self.id), eq(schema.savedPicks.qlooId, s.qlooId)))
    }
  }
  if (retune)
    await enqueueDebounced("tasteRetune", { personId: self.id }, FEED.retuneSeconds, self.id)
  return json({ ok: true, retune })
}
