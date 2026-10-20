import { migrateDatabase } from "@najimi/db/migrate"
import { boss, type Payload, QUEUES } from "@najimi/jobs"
import { emit, setRunStatus } from "@najimi/live"
import { closeInterruptedRuns } from "./interrupted"
import { businessSetup } from "./jobs/business-setup"

/*
 * The worker: every slow job runs here, never inside a web request (plan §4.6). It applies the
 * database migrations at start, closes runs a previous process left half-done, then works the
 * queues. Stages register their queues' handlers below.
 */

const STEP_PAUSE_MS = 400

async function main() {
  await migrateDatabase()
  await closeInterruptedRuns()
  const queues = await boss({ worker: true })

  // S00: the live pipe, end to end. Each step is a real event a page can watch arrive.
  await queues.work<Payload<"liveCheck">>(
    QUEUES.liveCheck.name,
    { localConcurrency: 2 },
    async ([job]) => {
      if (!job) return
      const { runId } = QUEUES.liveCheck.payload.parse(job.data)
      await setRunStatus(runId, "running")
      for (const step of ["queue", "worker", "database", "stream"]) {
        await emit(runId, "step", { step })
        await new Promise((resolve) => setTimeout(resolve, STEP_PAUSE_MS))
      }
      await setRunStatus(runId, "done")
    },
  )

  await queues.work<Payload<"businessSetup">>(
    QUEUES.businessSetup.name,
    { localConcurrency: 3 },
    async ([job]) => {
      if (!job) return
      const { businessId, runId } = QUEUES.businessSetup.payload.parse(job.data)
      await businessSetup(businessId, runId)
    },
  )

  console.log("[worker] ready")

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal}: finishing current jobs`)
    await queues.stop({ graceful: true, timeout: 3000 })
    process.exit(0)
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  process.on("SIGINT", () => void shutdown("SIGINT"))
}

main().catch((error) => {
  console.error("[worker] failed to start", error)
  process.exit(1)
})
