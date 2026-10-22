import { FEED, TASTE, TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { enqueueDebounced } from "@najimi/jobs"
import { and, asc, count, eq, sql } from "drizzle-orm"
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
  let full = false
  for (const s of signals) {
    if (s.kind === "love" && s.name) {
      const name = s.name
      const result = await db.transaction(async (tx) => {
        // One love at a time per person, so two quick batches can't both pass the cap.
        await tx.execute(
          sql`select 1 from ${schema.people} where ${schema.people.id} = ${self.id} for update`,
        )
        const [already] = await tx
          .select({ id: schema.loves.id })
          .from(schema.loves)
          .where(and(eq(schema.loves.personId, self.id), eq(schema.loves.qlooId, s.qlooId)))
        if (already) return "already" as const
        const [{ n } = { n: 0 }] = await tx
          .select({ n: count() })
          .from(schema.loves)
          .where(eq(schema.loves.personId, self.id))
        // A full taste makes room by letting go of the oldest love the feed added (never one they
        // picked themselves).
        if (n >= TASTE.seedsMax) {
          const [oldest] = await tx
            .select({ id: schema.loves.id })
            .from(schema.loves)
            .where(and(eq(schema.loves.personId, self.id), eq(schema.loves.source, "feed")))
            .orderBy(asc(schema.loves.createdAt))
            .limit(1)
          if (!oldest) return "full" as const
          await tx.delete(schema.loves).where(eq(schema.loves.id, oldest.id))
        }
        await tx.insert(schema.loves).values({
          personId: self.id,
          qlooId: s.qlooId,
          type: s.type,
          name,
          imageUrl: s.image ?? null,
          weight: FEED.loveWeight,
          source: "feed",
        })
        return "added" as const
      })
      if (result === "added") retune = true
      if (result === "full") full = true
    } else if (s.kind === "unlove") {
      const gone = await db
        .delete(schema.loves)
        .where(
          and(
            eq(schema.loves.personId, self.id),
            eq(schema.loves.qlooId, s.qlooId),
            eq(schema.loves.source, "feed"),
          ),
        )
        .returning({ id: schema.loves.id })
      if (gone.length) retune = true
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
  return json({ ok: true, retune, full })
}
