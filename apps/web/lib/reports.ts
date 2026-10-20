import "server-only"
import { db, schema } from "@najimi/db"
import { desc, eq } from "drizzle-orm"

/** The business's newest report, or null. */
export async function latestReport(businessId: string) {
  const [report] = await db
    .select()
    .from(schema.peopleReports)
    .where(eq(schema.peopleReports.businessId, businessId))
    .orderBy(desc(schema.peopleReports.createdAt))
    .limit(1)
  return report ?? null
}

/** What a report is built on (R12): the business itself in Qloo, else its comparables. */
export async function reportBasis(business: typeof schema.businesses.$inferSelect) {
  const matches = await db
    .select()
    .from(schema.qlooMatches)
    .where(eq(schema.qlooMatches.businessId, business.id))
  const own = matches.find((m) => m.role === "own")
  const comparables = matches.filter((m) => m.role === "comparable").slice(0, 5)
  return {
    route: own ? ("own" as const) : ("comparables" as const),
    entities: own
      ? [{ entityId: own.entityId, name: own.name }]
      : comparables.map((c) => ({ entityId: c.entityId, name: c.name })),
    city: business.city,
  }
}
