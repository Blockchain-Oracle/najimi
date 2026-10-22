import { buildTuneUp } from "@najimi/connectors/tuneup"
import { db, schema } from "@najimi/db"
import type { TasteWords } from "@najimi/db/schema"
import { and, asc, eq, gte } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { selfOf } from "@/lib/people"

const dayIn = (tz: string | null) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "UTC" }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Today's tune-up: made the first time it's opened each day, then kept and ticked off. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const day = dayIn(new URL(request.url).searchParams.get("tz"))
  const [today] = await db
    .select()
    .from(schema.tuneUps)
    .where(and(eq(schema.tuneUps.userId, me), eq(schema.tuneUps.day, day)))
  if (today) return json({ day, items: today.items })
  const self = await selfOf(me)
  if (!self) return fail("Pick a few loves first", 409)
  const [loves, [taste], recent] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, self.id))
      .orderBy(asc(schema.loves.createdAt)),
    db
      .select({ words: schema.tastes.words })
      .from(schema.tastes)
      .where(eq(schema.tastes.personId, self.id)),
    db
      .select({ items: schema.tuneUps.items })
      .from(schema.tuneUps)
      .where(
        and(
          eq(schema.tuneUps.userId, me),
          gte(schema.tuneUps.createdAt, new Date(Date.now() - 14 * 86_400_000)),
        ),
      ),
  ])
  const words = taste?.words as TasteWords | null
  const seen = new Set(
    recent.flatMap((r) =>
      r.items.map((i) => `${i.platform}:${(i.handle ?? i.label).toLowerCase()}`),
    ),
  )
  const items = await buildTuneUp({
    loves: loves.map((l) => ({ qlooId: l.qlooId, name: l.name, weight: l.weight })),
    words: [...(words?.lifestyle ?? []), ...(words?.aesthetic ?? [])].slice(0, 6),
    seen,
    ctx: { userId: me, purpose: "Your feeds' tune-up" },
  })
  await db.insert(schema.tuneUps).values({ userId: me, day, items }).onConflictDoNothing()
  return json({ day, items })
}

const tick = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itemId: z.string().max(200),
  done: z.boolean(),
})

/** Ticks a tune-up item off (or back on). */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, tick)
  if ("error" in parsed) return parsed.error
  const { day, itemId, done } = parsed.data
  const [row] = await db
    .select()
    .from(schema.tuneUps)
    .where(and(eq(schema.tuneUps.userId, auth.session.user.id), eq(schema.tuneUps.day, day)))
  if (!row) return fail("No tune-up that day", 404)
  const items = row.items.map((i) => (i.id === itemId ? { ...i, done } : i))
  await db.update(schema.tuneUps).set({ items }).where(eq(schema.tuneUps.id, row.id))
  return json({ items })
}
