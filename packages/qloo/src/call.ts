import { QLOO } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { cacheKey, normalizeParams, type Params, QlooError, qlooFetch } from "./client"

/**
 * Who a call is for, so it lands in their evidence and the chat's Built-on-Qloo log. No user means a
 * shared lookup (the loves typeahead) that is never shown as anyone's evidence.
 */
export type CallContext = {
  userId?: string | null
  chatId?: string | null
  messageId?: string | null
  runId?: string | null
  /** Why the call was made, in plain words ("Books for your taste"). */
  purpose?: string
}

export type CallResult<T = unknown> = {
  /** The call log row: what evidence chips point to (plan R1). */
  callId: string
  status: number
  body: T
  cacheHit: boolean
}

function ttlFor(path: string): number {
  let best = ""
  for (const prefix of Object.keys(QLOO.ttlMs)) {
    if (path.startsWith(prefix) && prefix.length > best.length) best = prefix
  }
  return best ? (QLOO.ttlMs[best] ?? QLOO.defaultTtlMs) : QLOO.defaultTtlMs
}

/** Counts what came back, for the log: entities, heatmap points, tags, demographics, trend points. */
function countResults(body: unknown): number | null {
  if (!body || typeof body !== "object") return null
  const results = (body as { results?: unknown }).results
  if (Array.isArray(results)) return results.length
  if (results && typeof results === "object") {
    for (const value of Object.values(results)) if (Array.isArray(value)) return value.length
  }
  return null
}

const limiter = (() => {
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= QLOO.concurrency) await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
      return await task()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
})()

/**
 * A Qloo GET through the private cache, logged for evidence. A fresh cached answer is served
 * without calling Qloo (and logged as a cache hit); only successful answers are cached.
 */
export async function qlooCall<T = unknown>(
  path: string,
  params: Params,
  context: CallContext = {},
): Promise<CallResult<T>> {
  const normalized = normalizeParams(params)
  const key = cacheKey(path, normalized)
  const log = async (entry: {
    status: number | null
    ms: number | null
    cacheHit: boolean
    resultCount: number | null
    error?: string
  }) => {
    const [row] = await db
      .insert(schema.qlooCalls)
      .values({
        userId: context.userId ?? null,
        chatId: context.chatId ?? null,
        messageId: context.messageId ?? null,
        runId: context.runId ?? null,
        purpose: context.purpose ?? null,
        path,
        params: normalized,
        cacheKey: key,
        status: entry.status,
        ms: entry.ms,
        cacheHit: entry.cacheHit,
        resultCount: entry.resultCount,
        error: entry.error ?? null,
      })
      .returning({ id: schema.qlooCalls.id })
    return row?.id ?? ""
  }

  const [cached] = await db.select().from(schema.qlooCache).where(eq(schema.qlooCache.key, key))
  if (cached && cached.expiresAt > new Date()) {
    const callId = await log({
      status: cached.status,
      ms: 0,
      cacheHit: true,
      resultCount: countResults(cached.body),
    })
    return { callId, status: cached.status, body: cached.body as T, cacheHit: true }
  }

  try {
    const response = await limiter(() => qlooFetch(path, normalized))
    if (response.status < 400) {
      const expiresAt = new Date(Date.now() + ttlFor(path))
      await db
        .insert(schema.qlooCache)
        .values({
          key,
          path,
          params: normalized,
          status: response.status,
          body: response.body as object,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: schema.qlooCache.key,
          set: {
            status: response.status,
            body: response.body as object,
            fetchedAt: new Date(),
            expiresAt,
          },
        })
    }
    const callId = await log({
      status: response.status,
      ms: response.ms,
      cacheHit: false,
      resultCount: countResults(response.body),
    })
    return { callId, status: response.status, body: response.body as T, cacheHit: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Qloo call failed"
    await log({
      status: error instanceof QlooError ? error.status : null,
      ms: null,
      cacheHit: false,
      resultCount: null,
      error: message,
    })
    throw error
  }
}
