import { buildBusiness } from "@najimi/agent/server"
import { db, schema } from "@najimi/db"
import { publish, topic } from "@najimi/live"
import { and, eq, gte } from "drizzle-orm"

/*
 * Every Monday, a business's plan is built again from this week's Qloo, and its owner hears what
 * moved: places newly rising around it among its fans, and where its people cluster now.
 */

const ACTIVE_DAYS = 45

export async function businessWeekly() {
  const since = new Date(Date.now() - ACTIVE_DAYS * 86_400_000)
  const rows = await db
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.status, "ready"), gte(schema.businesses.updatedAt, since)))
  for (const b of rows) {
    const before = new Set((b.report?.rising ?? []).map((r) => r.qlooId))
    const [run] = await db
      .insert(schema.runs)
      .values({ ownerId: b.ownerId, kind: "business", subject: { businessId: b.id } })
      .returning({ id: schema.runs.id })
    await db
      .update(schema.businesses)
      .set({ runId: run?.id ?? null, checkedAt: new Date() })
      .where(eq(schema.businesses.id, b.id))
    await buildBusiness(b.id, { notify: false })
    const [after] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, b.id))
    const fresh = (after?.report?.rising ?? []).filter((r) => !before.has(r.qlooId))
    const text = fresh.length
      ? `This week around ${b.name}: ${fresh.map((r) => r.name).join(", ")} ${fresh.length === 1 ? "is" : "are"} rising among your people`
      : `${b.name}'s plan is fresh for this week`
    const [note] = await db
      .insert(schema.notifications)
      .values({ userId: b.ownerId, kind: "booking", data: { text, businessId: b.id } })
      .returning({ id: schema.notifications.id })
    await publish(topic.user(b.ownerId), "notification", { id: note?.id, kind: "booking" })
  }
  console.log(`[business] weekly: ${rows.length} plan(s) rebuilt`)
}
