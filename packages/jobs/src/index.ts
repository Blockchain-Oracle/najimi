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

/** Enqueues a job to start at a set time. */
export async function enqueueAt<Q extends QueueName>(queue: Q, data: Payload<Q>, at: Date) {
  const parsed = QUEUES[queue].payload.parse(data)
  return (await boss()).send(QUEUES[queue].name, parsed, { ...QUEUES[queue].send, startAfter: at })
}
