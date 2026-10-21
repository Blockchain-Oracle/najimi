import { db, schema } from "@najimi/db"
import { emit } from "@najimi/live"
import { and, eq, inArray, sql } from "drizzle-orm"

const today = () => new Date().toISOString().slice(0, 10)

/**
 * A run that was running when the last worker process stopped (deploy, crash) can't finish on its
 * own. At start each is marked failed with a plain reason, so no page waits forever. An image
 * request cut off mid-way is failed too, and the allowance it took is given back. Videos waiting
 * on the provider are not touched: the poller resumes them by their provider id.
 */
export async function closeInterruptedRuns(): Promise<void> {
  const reason = "Interrupted by a restart"
  const cut = await db
    .update(schema.mediaJobs)
    .set({ status: "failed", error: reason })
    .where(
      and(
        eq(schema.mediaJobs.kind, "image"),
        inArray(schema.mediaJobs.status, ["queued", "running"]),
      ),
    )
    .returning({ id: schema.mediaJobs.id, ownerId: schema.mediaJobs.ownerId })
  for (const job of cut) {
    const lost = await db
      .update(schema.creations)
      .set({ status: "failed", error: reason })
      .where(and(eq(schema.creations.mediaJobId, job.id), eq(schema.creations.status, "pending")))
      .returning({ id: schema.creations.id })
    for (const id of [job.ownerId, "*"])
      await db
        .update(schema.usageDays)
        .set({ images: sql`greatest(${schema.usageDays.images} - ${lost.length}, 0)` })
        .where(and(eq(schema.usageDays.userId, id), eq(schema.usageDays.day, today())))
  }
  const open = await db
    .update(schema.runs)
    .set({ status: "failed", error: reason, finishedAt: new Date() })
    .where(inArray(schema.runs.status, ["running"]))
    .returning({ id: schema.runs.id })
  for (const run of open) await emit(run.id, "status", { status: "failed", error: reason })
  if (open.length) console.log(`[worker] closed ${open.length} interrupted run(s)`)
}
