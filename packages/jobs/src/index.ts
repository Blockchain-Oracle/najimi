import { JOBS } from "@najimi/config"
import { env } from "@najimi/env/server"
import { PgBoss } from "pg-boss"
import { z } from "zod"

/**
 * Every background queue, with the payload it carries (validated on both sides). Stages add their
 * queues here; nothing outbound or paid is ever retried automatically (retryLimit 0).
 */
export const QUEUES = {
  /** Proves the pipe end to end: a run's steps reach an open page live (S00 health check). */
  liveCheck: {
    name: "live-check",
    payload: z.object({ runId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 5 * 60 },
    send: { heartbeatSeconds: JOBS.heartbeatSeconds },
  },
  /**
   * A person's taste (T2): words and picks per domain from their weighted loves, each landing on
   * the reveal as it arrives. Qloo answers are cached, so a retry is cheap.
   */
  tasteRefresh: {
    name: "taste-refresh",
    payload: z.object({ personId: z.uuid(), runId: z.uuid() }),
    options: { retryLimit: 1, retryDelay: 5, expireInSeconds: 5 * 60 },
    send: { heartbeatSeconds: JOBS.heartbeatSeconds },
  },
  /**
   * The taste again once loves from the feed settle (sent debounced per person, so ten quick
   * loves cost one recompute). The worker opens the run itself; nobody is watching a reveal.
   */
  tasteRetune: {
    name: "taste-retune",
    payload: z.object({ personId: z.uuid() }),
    options: { retryLimit: 1, retryDelay: 10, expireInSeconds: 5 * 60 },
    send: { heartbeatSeconds: JOBS.heartbeatSeconds },
  },
  /**
   * Najimi's turn in a room: one running and at most one waiting per room (sent with the room as
   * the key), and the waiting one answers everything said in the meantime. Never retried: a turn
   * may have acted (made an image, booked).
   */
  agentTurn: {
    name: "agent-turn",
    payload: z.object({ chatId: z.uuid() }),
    options: { policy: "stately", retryLimit: 0, expireInSeconds: 10 * 60 },
    send: { heartbeatSeconds: JOBS.heartbeatSeconds },
  },
  /** A new chat's title, in the chat's language, once its first answer is in. */
  chatTitle: {
    name: "chat-title",
    payload: z.object({ chatId: z.uuid() }),
    options: { retryLimit: 1, retryDelay: 10, expireInSeconds: 2 * 60 },
    send: { heartbeatSeconds: JOBS.heartbeatSeconds },
  },
  /**
   * Making media (T9–T11): one provider request. Images finish inside the job; a video is
   * submitted to the provider and finished by the worker's poller. Not retried: a paid request
   * is never sent twice (a failed one is refunded and the card offers Retry).
   */
  mediaGenerate: {
    name: "media-generate",
    payload: z.object({ jobId: z.uuid() }),
    options: { retryLimit: 0, expireInSeconds: 10 * 60 },
    send: { heartbeatSeconds: JOBS.heartbeatSeconds },
  },
  /**
   * Deleting stored objects whose rows are already gone ("delete all my data", the guest sweep):
   * only when deleting them straight away failed. Safe to repeat, so it's retried.
   */
  storageDelete: {
    name: "storage-delete",
    payload: z.object({ keys: z.array(z.string().min(1)).min(1).max(5000) }),
    options: { retryLimit: 5, retryDelay: 60, retryBackoff: true, expireInSeconds: 5 * 60 },
    send: {},
  },
  /** Every morning: a wavelength round about one member, dealt into each circle active this week. */
  dailyDrop: {
    name: "daily-drop",
    payload: z.object({}),
    options: { retryLimit: 1, retryDelay: 600, expireInSeconds: 30 * 60 },
    send: {},
  },
  /** Every night: guests nobody has used for a month go, rows and objects (T21). */
  guestsCleanup: {
    name: "guests-cleanup",
    payload: z.object({}),
    options: { retryLimit: 1, retryDelay: 600, expireInSeconds: 15 * 60 },
    send: {},
  },
} as const

/** Queues an earlier version of the product used; the worker deletes them once at start. */
export const RETIRED_QUEUES = ["business-setup", "place-setup", "people-report"] as const

export type QueueName = keyof typeof QUEUES
export type Payload<Q extends QueueName> = z.infer<(typeof QUEUES)[Q]["payload"]>

const globalForBoss = globalThis as unknown as { najimiBoss?: Promise<PgBoss> }

/**
 * One pg-boss instance per process. Producers (the web app) skip maintenance and scheduling;
 * the worker passes `{ worker: true }` and owns both.
 */
export function boss({ worker = false } = {}): Promise<PgBoss> {
  globalForBoss.najimiBoss ??= (async () => {
    const instance = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: JOBS.schema,
      supervise: worker,
      schedule: worker,
      application_name: worker ? "najimi-worker" : "najimi-web",
    })
    instance.on("error", (error) => console.error("[pg-boss]", error))
    await instance.start()
    for (const queue of Object.values(QUEUES)) {
      await instance.createQueue(queue.name, queue.options)
    }
    return instance
  })()
  return globalForBoss.najimiBoss
}

/** Enqueues a job; the payload is checked against the queue's schema first. */
export async function enqueue<Q extends QueueName>(
  queue: Q,
  data: Payload<Q>,
  singletonKey?: string,
) {
  const parsed = QUEUES[queue].payload.parse(data)
  return (await boss()).send(QUEUES[queue].name, parsed, { ...QUEUES[queue].send, singletonKey })
}

/**
 * Enqueues a job at most once per `seconds` per key; a send inside a busy window moves to the next
 * one instead of being dropped (pg-boss `sendDebounced`), so the last change is always picked up.
 */
export async function enqueueDebounced<Q extends QueueName>(
  queue: Q,
  data: Payload<Q>,
  seconds: number,
  key: string,
) {
  const parsed = QUEUES[queue].payload.parse(data)
  return (await boss()).sendDebounced(
    QUEUES[queue].name,
    parsed,
    { ...QUEUES[queue].send },
    seconds,
    key,
  )
}

/** Enqueues a job to start at a set time. */
export async function enqueueAt<Q extends QueueName>(queue: Q, data: Payload<Q>, at: Date) {
  const parsed = QUEUES[queue].payload.parse(data)
  return (await boss()).send(QUEUES[queue].name, parsed, { ...QUEUES[queue].send, startAfter: at })
}
