import { dayIn, tuneUpFor } from "@najimi/connectors/today"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

/** Today's tune-up: made the first time it's opened each day, then kept and ticked off. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const day = dayIn(new URL(request.url).searchParams.get("tz"))
  const today = await tuneUpFor(auth.session.user.id, day)
  if (!today) return fail("Pick a few loves first", 409)
  return json({ day, items: today.items })
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
