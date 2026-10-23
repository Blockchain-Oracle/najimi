import "server-only"
import { lookById } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import { enqueue } from "@najimi/jobs"
import { and, asc, desc, eq, gte, sql } from "drizzle-orm"

export type PersonRow = typeof schema.people.$inferSelect
export type LoveRow = typeof schema.loves.$inferSelect
export type TasteRow = typeof schema.tastes.$inferSelect
export type SavedRow = typeof schema.savedPicks.$inferSelect

/** A person the user keeps a taste for, or null when it isn't theirs. */
export async function ownedPerson(userId: string, personId: string): Promise<PersonRow | null> {
  const [row] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, personId), eq(schema.people.ownerId, userId)))
  return row ?? null
}

export async function selfOf(userId: string): Promise<PersonRow | null> {
  const [row] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  return row ?? null
}

export async function peopleOf(userId: string): Promise<PersonRow[]> {
  return db
    .select()
    .from(schema.people)
    .where(eq(schema.people.ownerId, userId))
    .orderBy(desc(schema.people.isSelf), asc(schema.people.createdAt))
}

/** Everything a person page shows: who, their loves, their taste and what they kept. */
export async function personPage(userId: string, personId: string) {
  const person = await ownedPerson(userId, personId)
  if (!person) return null
  const [loves, [taste], saved, [run], [account]] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, personId))
      .orderBy(asc(schema.loves.createdAt)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, personId)),
    db
      .select()
      .from(schema.savedPicks)
      .where(eq(schema.savedPicks.personId, personId))
      .orderBy(desc(schema.savedPicks.createdAt)),
    db
      .select({ status: schema.runs.status })
      .from(schema.runs)
      .innerJoin(schema.tastes, eq(schema.tastes.runId, schema.runs.id))
      .where(eq(schema.tastes.personId, personId)),
    db
      .select({ username: schema.user.displayUsername })
      .from(schema.user)
      .where(eq(schema.user.id, person.ownerId)),
  ])
  return {
    person,
    username: account?.username ?? null,
    loves,
    taste: taste ?? null,
    saved,
    runStatus: run?.status ?? null,
  }
}

/**
 * "Not for me" (rule 3): the pick leaves the person's taste page at once and is excluded from
 * every later Qloo call made for them (the feed included).
 */
export async function hidePick(personId: string, qlooId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.people)
      .set({
        excludedIds: sql`array_append(array_remove(${schema.people.excludedIds}, ${qlooId}), ${qlooId})`,
      })
      .where(eq(schema.people.id, personId))
    const [taste] = await tx
      .select()
      .from(schema.tastes)
      .where(eq(schema.tastes.personId, personId))
    if (taste?.picks) {
      const picks: Record<string, StoredPick[]> = Object.fromEntries(
        Object.entries(taste.picks).map(([d, list]) => [
          d,
          list.filter((p) => p.qlooId !== qlooId),
        ]),
      )
      await tx.update(schema.tastes).set({ picks }).where(eq(schema.tastes.personId, personId))
    }
  })
}

/** Starts recomputing a person's taste; the reveal watches the returned run. */
export async function startTasteRun(ownerId: string, personId: string): Promise<string> {
  // A run for this taste that hasn't started yet picks up every change made meanwhile (it reads
  // the loves when it starts), so quick weight changes share one recompute instead of each
  // starting their own.
  const [waiting] = await db
    .select({ id: schema.runs.id })
    .from(schema.runs)
    .where(
      and(
        eq(schema.runs.ownerId, ownerId),
        eq(schema.runs.kind, "taste"),
        eq(schema.runs.status, "queued"),
        sql`${schema.runs.subject}->>'personId' = ${personId}`,
        gte(schema.runs.createdAt, new Date(Date.now() - 60_000)),
      ),
    )
    .limit(1)
  if (waiting) return waiting.id
  const [run] = await db
    .insert(schema.runs)
    .values({ ownerId, kind: "taste", subject: { personId } })
    .returning({ id: schema.runs.id })
  if (!run) throw new Error("Couldn't start the taste run")
  await db
    .insert(schema.tastes)
    .values({ personId, runId: run.id })
    .onConflictDoUpdate({ target: schema.tastes.personId, set: { runId: run.id } })
  await enqueue("tasteRefresh", { personId, runId: run.id })
  return run.id
}

const IDENTITY = ["violet", "pink", "cobalt", "orange", "teal", "butter"] as const
export type Identity = (typeof IDENTITY)[number]

/**
 * Each person keeps one identity colour: the face they picked, or one drawn from their id.
 */
export function identityOf(personId: string, look?: string | null): Identity {
  const picked = lookById(look)
  if (picked) return picked.identity
  let hash = 0
  for (const ch of personId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return IDENTITY[hash % IDENTITY.length] ?? "violet"
}
