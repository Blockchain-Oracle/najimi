import "server-only"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"

/** The business, if it belongs to this user; null otherwise (callers answer 404, not 403). */
export async function ownedBusiness(userId: string, businessId: string) {
  const [row] = await db
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.id, businessId), eq(schema.businesses.ownerId, userId)))
  return row ?? null
}
