import { db, schema } from "@najimi/db"
import { emit } from "@najimi/live"
import { inArray } from "drizzle-orm"

/**
 * A run that was queued or running when the last worker process stopped (deploy, crash) can't
 * finish on its own: its job is either retried by pg-boss (and sets the status again) or gone.
 * At start, every such run is marked failed with a plain reason, so no page waits forever.
 */
export async function closeInterruptedRuns(): Promise<void> {
  const open = await db
    .update(schema.runs)
    .set({ status: "failed", error: "Interrupted by a restart", finishedAt: new Date() })
    .where(inArray(schema.runs.status, ["running"]))
    .returning({ id: schema.runs.id })
  for (const run of open)
    await emit(run.id, "status", { status: "failed", error: "Interrupted by a restart" })
  if (open.length) console.log(`[worker] closed ${open.length} interrupted run(s)`)
}
