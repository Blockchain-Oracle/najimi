import { MEDIA } from "@najimi/config"
import { migrateDatabase } from "@najimi/db/migrate"
import { boss, type Payload, QUEUES, RETIRED_QUEUES } from "@najimi/jobs"
import { emit, setRunStatus } from "@najimi/live"
import { closeInterruptedRuns } from "./interrupted"
import { chatTitle } from "./jobs/chat-title"
import { mediaGenerate, pollVideos } from "./jobs/media"
import { tasteRefresh } from "./jobs/taste-refresh"
import { seedSamples } from "./samples"
import { seedWorkflows } from "./workflows"

/*
 * The worker: every slow job runs here, never inside a web request. It applies the
 * database migrations at start, closes runs a previous process left half-done, then works the
 * queues. Stages register their queues' handlers below.
 */

const STEP_PAUSE_MS = 400

async function main() {
  await migrateDatabase()
  await closeInterruptedRuns()
  await seedSamples().catch((error) => console.error("[worker] samples", error))
  await seedWorkflows().catch((error) => console.error("[worker] workflows", error))
  const queues = await boss({ worker: true })
  for (const name of RETIRED_QUEUES) {
    if (await queues.getQueue(name)) await queues.deleteQueue(name)
  }

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

  await queues.work<Payload<"tasteRefresh">>(
    QUEUES.tasteRefresh.name,
    { localConcurrency: 3 },
    async ([job]) => {
      if (!job) return
      const { personId, runId } = QUEUES.tasteRefresh.payload.parse(job.data)
      await tasteRefresh(personId, runId)
    },
  )

  await queues.work<Payload<"chatTitle">>(
    QUEUES.chatTitle.name,
    { localConcurrency: 4 },
    async ([job]) => {
      if (!job) return
      await chatTitle(QUEUES.chatTitle.payload.parse(job.data).chatId)
    },
  )

  await queues.work<Payload<"mediaGenerate">>(
    QUEUES.mediaGenerate.name,
    { localConcurrency: 3 },
    async ([job]) => {
      if (!job) return
      await mediaGenerate(QUEUES.mediaGenerate.payload.parse(job.data).jobId)
    },
  )
  // Submitted videos are checked here; a restart picks them up again by their provider id.
  const poller = setInterval(
    () => void pollVideos().catch((e) => console.error("[poll]", e)),
    MEDIA.pollMs,
  )

  console.log("[worker] ready")

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal}: finishing current jobs`)
    clearInterval(poller)
    await queues.stop({ graceful: true, timeout: 20_000 })
    process.exit(0)
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  process.on("SIGINT", () => void shutdown("SIGINT"))
}

main().catch((error) => {
  console.error("[worker] failed to start", error)
  process.exit(1)
})
