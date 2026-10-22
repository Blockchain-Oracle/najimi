import { LIVE } from "@najimi/config"
import { type Db, db, schema, type Tx } from "@najimi/db"
import { and, asc, eq, gt, lt, sql } from "drizzle-orm"

/*
 * The live pipe, by topic: a run's steps (`run:<id>`), a room's messages as they stream
 * (`room:<id>`), a person's own news (`user:<id>`). Every event is an append-only `live_events`
 * row, announced on one Postgres channel in the same transaction, so a listener never hears of a
 * row it can't read yet. The announcement carries ids only; pages read the rows through a route
 * that checks they may, and a reconnecting page replays what it missed by id.
 */

export type LiveNotice = { topic: string; id: number }

export type LiveEvent = {
  id: number
  topic: string
  type: string
  data: Record<string, unknown>
  createdAt: Date
}

export const topic = {
  run: (id: string) => `run:${id}`,
  room: (id: string) => `room:${id}`,
  user: (id: string) => `user:${id}`,
}

/** Records one event on a topic and announces it, inside the caller's transaction (or its own). */
export async function publish(
  name: string,
  type: string,
  data: Record<string, unknown> = {},
  tx: Tx | Db = db,
): Promise<number> {
  const [row] = await tx
    .insert(schema.liveEvents)
    .values({ topic: name, type, data })
    .returning({ id: schema.liveEvents.id })
  const id = row?.id ?? 0
  const notice: LiveNotice = { topic: name, id }
  await tx.execute(sql`select pg_notify(${LIVE.channel}, ${JSON.stringify(notice)})`)
  return id
}

/** One step of a run (the taste reveal, a picture being made). */
export const emit = (
  runId: string,
  type: string,
  data: Record<string, unknown> = {},
  tx: Tx | Db = db,
) => publish(topic.run(runId), type, data, tx)

/** Moves a run to a new status and records it as an event, atomically. */
export async function setRunStatus(
  runId: string,
  status: (typeof schema.runStatus.enumValues)[number],
  error?: string,
): Promise<void> {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(schema.runs)
      .set({
        status,
        error: error ?? null,
        ...(status === "running" ? { startedAt: now } : {}),
        ...(["done", "failed", "cancelled"].includes(status) ? { finishedAt: now } : {}),
      })
      .where(eq(schema.runs.id, runId))
    await emit(runId, "status", { status, ...(error ? { error } : {}) }, tx)
  })
}

/** A topic's events after a given id, oldest first (a page's catch-up after it reconnects). */
export async function eventsAfter(name: string, afterId: number): Promise<LiveEvent[]> {
  return db
    .select()
    .from(schema.liveEvents)
    .where(and(eq(schema.liveEvents.topic, name), gt(schema.liveEvents.id, afterId)))
    .orderBy(asc(schema.liveEvents.id))
    .limit(LIVE.replayMax)
}

/** The newest event id on a topic (a page that loaded fresh data starts listening after it). */
export async function lastEventId(name: string): Promise<number> {
  const [row] = await db
    .select({ id: sql<number>`coalesce(max(${schema.liveEvents.id}), 0)` })
    .from(schema.liveEvents)
    .where(eq(schema.liveEvents.topic, name))
  return Number(row?.id ?? 0)
}

/** Old events go: pages only ever replay the last few minutes of a topic. */
export async function sweepLiveEvents(olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs)
  const result = await db.delete(schema.liveEvents).where(lt(schema.liveEvents.createdAt, cutoff))
  return (result as unknown as { count?: number }).count ?? 0
}
