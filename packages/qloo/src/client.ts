import { createHash } from "node:crypto"
import { QLOO } from "@najimi/config"
import { env } from "@najimi/env/server"

/** A query parameter value as callers write it; arrays are joined with commas (GET only). */
export type ParamValue = string | number | boolean | readonly (string | number)[] | undefined
export type Params = Record<string, ParamValue>

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = "QlooError"
  }
}

/** Qloo isn't configured on this server: features that need it say so instead of failing oddly. */
export class QlooNotConfigured extends QlooError {
  constructor() {
    super("Qloo isn't connected yet (QLOO_API_KEY is not set)", null, false)
    this.name = "QlooNotConfigured"
  }
}

export function qlooConfigured(): boolean {
  return Boolean(env.QLOO_API_KEY)
}

/** Drops undefined values, joins arrays with commas and sorts keys, so equal queries match. */
export function normalizeParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? value.join(",") : String(value)
  }
  return out
}

export function cacheKey(path: string, params: Record<string, string>): string {
  return createHash("sha256")
    .update(`${path}?${new URLSearchParams(params).toString()}`)
    .digest("hex")
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function backoffMs(attempt: number): number {
  const base = QLOO.backoffBaseMs * 2 ** (attempt - 1)
  const jitter = base * QLOO.backoffJitter * (Math.random() * 2 - 1)
  return Math.round(base + jitter)
}

function retryAfterMs(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now()
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, QLOO.retryAfterCapMs) : null
}

export type RawResponse = {
  status: number
  body: unknown
  ms: number
  bytes: number
  /** Headers worth recording (request id, rate limits, retry-after). */
  headers: Record<string, string>
}

const KEPT_HEADERS = /^(x-qloo-request-id|retry-after|x-ratelimit-.*|ratelimit.*|x-request-id)$/i

/**
 * One GET to the hackathon host: `X-Api-Key`, a 20 s timeout per attempt, up to three attempts on
 * 429 and 5xx (honouring Retry-After), and a 5 MB body cap. 4xx other than 429 is returned as is
 * (a 404 from /search means "no results", not a failure).
 */
export async function qlooFetch(
  path: string,
  params: Record<string, string>,
): Promise<RawResponse> {
  const key = env.QLOO_API_KEY
  if (!key) throw new QlooNotConfigured()
  const url = new URL(path, QLOO.baseUrl)
  url.search = new URLSearchParams(params).toString()
  const started = Date.now()
  let lastError: QlooError | null = null

  for (let attempt = 1; attempt <= QLOO.attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        signal: AbortSignal.timeout(QLOO.timeoutMs),
      })
      const declared = Number(response.headers.get("content-length") ?? 0)
      if (declared > QLOO.maxBodyBytes)
        throw new QlooError("Response too large", response.status, false)
      const text = await response.text()
      if (text.length > QLOO.maxBodyBytes)
        throw new QlooError("Response too large", response.status, false)

      if ((QLOO.retryStatuses as readonly number[]).includes(response.status)) {
        lastError = new QlooError(`Qloo answered ${response.status}`, response.status, true)
        if (attempt < QLOO.attempts) {
          await sleep(retryAfterMs(response.headers.get("retry-after")) ?? backoffMs(attempt))
          continue
        }
        throw lastError
      }
      let body: unknown = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        throw new QlooError("Qloo returned something that isn't JSON", response.status, false)
      }
      const headers: Record<string, string> = {}
      response.headers.forEach((value, name) => {
        if (KEPT_HEADERS.test(name)) headers[name] = value
      })
      return {
        status: response.status,
        body,
        ms: Date.now() - started,
        bytes: text.length,
        headers,
      }
    } catch (error) {
      if (error instanceof QlooError && !error.retryable) throw error
      const timedOut = error instanceof DOMException && error.name === "TimeoutError"
      lastError =
        error instanceof QlooError
          ? error
          : new QlooError(timedOut ? "Qloo took too long" : "Couldn't reach Qloo", null, true)
      if (attempt < QLOO.attempts) await sleep(backoffMs(attempt))
    }
  }
  throw lastError ?? new QlooError("Couldn't reach Qloo", null, true)
}
