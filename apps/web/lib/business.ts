import "server-only"
import { db, schema } from "@najimi/db"
import { and, desc, eq } from "drizzle-orm"

/*
 * Businesses (W19): an owner's own, and a shared plan by its token. What a page may see: never
 * another owner's business except through a link they chose to share.
 */

export type BusinessRow = typeof schema.businesses.$inferSelect

export async function businessOf(id: string, ownerId: string): Promise<BusinessRow | null> {
  const [row] = await db
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.id, id), eq(schema.businesses.ownerId, ownerId)))
  return row ?? null
}

export async function businessesOf(ownerId: string): Promise<BusinessRow[]> {
  return db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.ownerId, ownerId))
    .orderBy(desc(schema.businesses.createdAt))
}

export async function sharedBusiness(token: string): Promise<BusinessRow | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null
  const [row] = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.shareToken, token))
  return row?.status === "ready" ? row : null
}

/** What the plan page needs (no owner id, no run internals). */
export const viewOfBusiness = (b: BusinessRow) => ({
  id: b.id,
  name: b.name,
  kind: b.kind,
  city: b.city,
  address: b.address,
  lat: b.lat,
  lon: b.lon,
  links: b.links,
  status: b.status,
  runId: b.runId,
  error: b.error,
  report: b.report,
  shareToken: b.shareToken,
  updatedAt: b.updatedAt.toISOString(),
})
export type BusinessView = ReturnType<typeof viewOfBusiness>
