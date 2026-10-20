import { LIVE } from "@najimi/config"
import { type Db, db, schema, type Tx } from "@najimi/db"
import { and, asc, eq, gt, sql } from "drizzle-orm"

/*
 * Live run progress (plan §4.6). Every step a run takes is an append-only `run_events` row, announced
 * on one Postgres channel in the same transaction, so a listener never hears of a row it can't read
 * yet. The announcement carries ids only; a page reads the rows through routes that check ownership,
 * and a reconnecting page replays what it missed by id.
 */

export type RunNotice = { runId: string; id: number }

export type RunEvent = {
  id: number
  runId: string
  type: string
  data: Record<string, unknown>
  createdAt: Date
}

/** Records one step of a run and announces it, inside the caller's transaction (or on its own). */
export async function emit(
  runId: string,
  type: string,
  data: Record<string, unknown> = {},
  tx: Tx | Db = db,
): Promise<number> {
  const [row] = await tx
    .insert(schema.runEvents)
    .values({ runId, type, data })
    .returning({ id: schema.runEvents.id })
  const id = row?.id ?? 0
  const notice: RunNotice = { runId, id }
  await tx.execute(sql`select pg_notify(${LIVE.channel}, ${JSON.stringify(notice)})`)
  return id
}

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

/** A run's events after a given id, oldest first (a page's catch-up after it reconnects). */
export async function eventsAfter(runId: string, afterId: number): Promise<RunEvent[]> {
  return db
    .select()
    .from(schema.runEvents)
    .where(and(eq(schema.runEvents.runId, runId), gt(schema.runEvents.id, afterId)))
    .orderBy(asc(schema.runEvents.id))
    .limit(LIVE.replayMax)
}
