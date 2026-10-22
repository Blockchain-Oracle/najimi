import { db, schema } from "@najimi/db"
import { eq, inArray, sql } from "drizzle-orm"

const DAY_MS = 24 * 60 * 60 * 1000

/** A cached look-up: served from Postgres while fresh, fetched (and kept) otherwise. */
export async function cached<T>(
  kind: string,
  key: string,
  days: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const id = `${kind}:${key}`
  const [hit] = await db.select().from(schema.externalCache).where(eq(schema.externalCache.key, id))
  if (hit && hit.expiresAt > new Date()) return hit.body as T
  const body = await fetcher()
  const expiresAt = new Date(Date.now() + days * DAY_MS)
  await db
    .insert(schema.externalCache)
    .values({ key: id, kind, body: body as object, expiresAt })
    .onConflictDoUpdate({
      target: schema.externalCache.key,
      set: { body: body as object, fetchedAt: new Date(), expiresAt },
    })
  return body
}

/**
 * Cached look-ups for many keys at once: the fresh ones from Postgres, the rest fetched in one go
 * (so a whole feed page is one request to the outside source) and kept. A key the fetcher answers
 * with null is remembered as "nothing" for the same time, so it isn't asked for again and again; a
 * key it leaves out wasn't tried (a budget ran out) and isn't stored.
 */
export async function cachedMany<T>(
  kind: string,
  keys: string[],
  days: number,
  fetchMany: (missing: string[]) => Promise<Record<string, T | null>>,
): Promise<Record<string, T | null>> {
  const unique = [...new Set(keys)]
  if (!unique.length) return {}
  const rows = await db
    .select()
    .from(schema.externalCache)
    .where(
      inArray(
        schema.externalCache.key,
        unique.map((k) => `${kind}:${k}`),
      ),
    )
  const now = new Date()
  const out: Record<string, T | null> = {}
  for (const row of rows) {
    if (row.expiresAt > now) out[row.key.slice(kind.length + 1)] = (row.body as { v: T | null }).v
  }
  const missing = unique.filter((k) => !(k in out))
  if (!missing.length) return out
  const fetched = await fetchMany(missing).catch(() => null)
  if (!fetched) return out
  const expiresAt = new Date(Date.now() + days * DAY_MS)
  const values = missing
    .filter((key) => key in fetched)
    .map((key) => {
      const v = fetched[key] ?? null
      out[key] = v
      return { key: `${kind}:${key}`, kind, body: { v } as object, expiresAt }
    })
  if (values.length)
    await db
      .insert(schema.externalCache)
      .values(values)
      .onConflictDoUpdate({
        target: schema.externalCache.key,
        set: {
          body: sql`excluded.body`,
          fetchedAt: sql`now()`,
          expiresAt: sql`excluded.expires_at`,
        },
      })
  return out
}
