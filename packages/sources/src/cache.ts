import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"

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
