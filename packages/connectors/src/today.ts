import { db, schema } from "@najimi/db"
import type { TasteWords, TuneUpItem } from "@najimi/db/schema"
import { and, asc, eq, gte } from "drizzle-orm"
import { buildTuneUp } from "./tuneup"

/** Today's date where someone is (YYYY-MM-DD). */
export const dayIn = (tz: string | null | undefined) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "UTC" }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * Someone's tune-up for a day: made the first time it's asked for (the screen or the worker), then
 * kept and ticked off. Null when they have no loves yet.
 */
export async function tuneUpFor(
  userId: string,
  day: string,
): Promise<{ id: string; items: TuneUpItem[] } | null> {
  const [today] = await db
    .select({ id: schema.tuneUps.id, items: schema.tuneUps.items })
    .from(schema.tuneUps)
    .where(and(eq(schema.tuneUps.userId, userId), eq(schema.tuneUps.day, day)))
  if (today) return today
  const [self] = await db
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  if (!self) return null
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
          eq(schema.tuneUps.userId, userId),
          gte(schema.tuneUps.createdAt, new Date(Date.now() - 14 * 86_400_000)),
        ),
      ),
  ])
  if (!loves.length) return null
  const words = taste?.words as TasteWords | null
  const seen = new Set(
    recent.flatMap((r) =>
      r.items.flatMap((i) => [
        `${i.platform}:${(i.target ?? i.handle ?? i.label).toLowerCase()}`,
        `${i.platform}:${i.label.toLowerCase()}`,
      ]),
    ),
  )
  const items = await buildTuneUp({
    loves: loves.map((l) => ({ qlooId: l.qlooId, name: l.name, weight: l.weight })),
    words: [...(words?.lifestyle ?? []), ...(words?.aesthetic ?? [])].slice(0, 6),
    seen,
    ctx: { userId, purpose: "Your feeds' tune-up" },
  })
  const [row] = await db
    .insert(schema.tuneUps)
    .values({ userId, day, items })
    .onConflictDoNothing()
    .returning({ id: schema.tuneUps.id, items: schema.tuneUps.items })
  if (row) return row
  const [raced] = await db
    .select({ id: schema.tuneUps.id, items: schema.tuneUps.items })
    .from(schema.tuneUps)
    .where(and(eq(schema.tuneUps.userId, userId), eq(schema.tuneUps.day, day)))
  return raced ?? null
}

/** Marks tune-up items done (or not), by id. */
export async function tickTuneUp(rowId: string, ids: string[], done: boolean) {
  const [row] = await db
    .select({ items: schema.tuneUps.items })
    .from(schema.tuneUps)
    .where(eq(schema.tuneUps.id, rowId))
  if (!row) return null
  const set = new Set(ids)
  const items = row.items.map((i) => (set.has(i.id) ? { ...i, done } : i))
  await db.update(schema.tuneUps).set({ items }).where(eq(schema.tuneUps.id, rowId))
  return items
}
