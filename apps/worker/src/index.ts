import { buildBusiness, runTurn } from "@najimi/agent/server"
import { AUTH, BUSINESS, MEDIA, ROOMS } from "@najimi/config"
import { migrateDatabase } from "@najimi/db/migrate"
import { ensureLounge } from "@najimi/games/lounge"
import { boss, type Payload, QUEUES, RETIRED_QUEUES } from "@najimi/jobs"
import { emit, setRunStatus, sweepLiveEvents } from "@najimi/live"
import { deleteKeys } from "@najimi/storage"
import { closeInterruptedRuns } from "./interrupted"
import { bookingCheck, followUps } from "./jobs/bookings"
import { businessWeekly } from "./jobs/business"
import { chatTitle } from "./jobs/chat-title"
import { dailyDrop } from "./jobs/daily-drop"
import { guestsCleanup } from "./jobs/forget"
import { mediaGenerate, pollVideos } from "./jobs/media"
import { socialMornings, socialRun } from "./jobs/social"
import { storiesExpire, storyVideo } from "./jobs/stories"
import { tasteRefresh, tasteRetune } from "./jobs/taste-refresh"
import { tuneUpNudge } from "./jobs/tune-up-nudge"
import { startPush } from "./push"
import { seedSamples } from "./samples"

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

  await queues.work<Payload<"tasteRetune">>(
    QUEUES.tasteRetune.name,
    { localConcurrency: 2 },
    async ([job]) => {
      if (!job) return
      const { personId } = QUEUES.tasteRetune.payload.parse(job.data)
      await tasteRetune(personId)
    },
  )

  // Najimi's turns in rooms: many rooms at once, one turn per room (the queue's policy).
  await queues.work<Payload<"agentTurn">>(
    QUEUES.agentTurn.name,
    { localConcurrency: 8 },
    async ([job]) => {
      if (!job) return
      await runTurn(QUEUES.agentTurn.payload.parse(job.data).chatId)
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
  await queues.work<Payload<"storageDelete">>(QUEUES.storageDelete.name, async ([job]) => {
    if (!job) return
    await deleteKeys(QUEUES.storageDelete.payload.parse(job.data).keys)
  })

  await queues.work(QUEUES.guestsCleanup.name, async ([job]) => {
    if (!job) return
    await guestsCleanup()
    // Live events are only ever replayed for a short while; old ones go.
    await sweepLiveEvents(ROOMS.liveKeepMs).catch((error) => console.error("[live] sweep", error))
  })
  await queues.schedule(QUEUES.guestsCleanup.name, AUTH.guestSweepCron, {}, { tz: "UTC" })

  // Stories (S18): a video made phone-ready; every hour, stories past their day go.
  await queues.work<Payload<"storyVideo">>(
    QUEUES.storyVideo.name,
    { localConcurrency: 1 },
    async ([job]) => {
      if (!job) return
      await storyVideo(QUEUES.storyVideo.payload.parse(job.data).storyId)
    },
  )
  await queues.work(QUEUES.storiesExpire.name, async ([job]) => {
    if (!job) return
    await storiesExpire()
  })
  await queues.schedule(QUEUES.storiesExpire.name, "35 * * * *", {}, { tz: "UTC" })

  // Najimi's own account and the public circle it runs; then the morning's drops.
  await ensureLounge().catch((error) => console.error("[lounge]", error))
  await queues.work(QUEUES.dailyDrop.name, async ([job]) => {
    if (!job) return
    await dailyDrop()
  })
  // Hourly: each circle gets its drop on its own morning.
  await queues.schedule(QUEUES.dailyDrop.name, "10 * * * *", {}, { tz: "UTC" })

  // Bookings: a call's result when its webhook doesn't come; "How was it?" once things happen.
  await queues.work<Payload<"bookingCheck">>(QUEUES.bookingCheck.name, async ([job]) => {
    if (!job) return
    await bookingCheck(QUEUES.bookingCheck.payload.parse(job.data).bookingId)
  })
  await queues.work(QUEUES.followUps.name, async ([job]) => {
    if (!job) return
    await followUps()
  })
  await queues.schedule(QUEUES.followUps.name, "*/30 * * * *", {}, { tz: "UTC" })
  await queues.work(QUEUES.tuneUpNudge.name, async ([job]) => {
    if (!job) return
    await tuneUpNudge()
  })
  // Hourly: each person is nudged on their own morning.
  await queues.schedule(QUEUES.tuneUpNudge.name, "20 * * * *", {}, { tz: "UTC" })

  // Business plans (W19), one build per business at a time; Mondays, each again with what changed.
  await queues.work<Payload<"businessBuild">>(
    QUEUES.businessBuild.name,
    { localConcurrency: 3 },
    async ([job]) => {
      if (!job) return
      await buildBusiness(QUEUES.businessBuild.payload.parse(job.data).businessId)
    },
  )
  await queues.work(QUEUES.businessWeekly.name, async ([job]) => {
    if (!job) return
    await businessWeekly()
  })
  await queues.schedule(QUEUES.businessWeekly.name, BUSINESS.weeklyCron, {}, { tz: "UTC" })

  // "Do it for me": each person's platforms, on their own morning, one run at a time each.
  await queues.work<Payload<"socialRun">>(
    QUEUES.socialRun.name,
    { localConcurrency: 4 },
    async ([job]) => {
      if (!job) return
      await socialRun(QUEUES.socialRun.payload.parse(job.data))
    },
  )
  await queues.work(QUEUES.socialMornings.name, async ([job]) => {
    if (!job) return
    await socialMornings()
  })
  await queues.schedule(QUEUES.socialMornings.name, "5 * * * *", {}, { tz: "UTC" })

  // People's news, pushed to the phones they turned push on for (W24).
  await startPush().catch((error) => console.error("[push] start", error))

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
