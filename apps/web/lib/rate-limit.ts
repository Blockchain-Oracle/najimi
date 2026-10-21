import "server-only"

/**
 * A small fixed-window limiter per key, in this process (one web container). Enough to stop a
 * script hammering Qloo or creating guests; not a billing control (the allowance is in Postgres).
 */
const windows = new Map<string, { start: number; count: number }>()

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 })
    if (windows.size > 50_000) windows.clear()
    return true
  }
  if (w.count >= max) return false
  w.count++
  return true
}

export const clientAddress = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local"
