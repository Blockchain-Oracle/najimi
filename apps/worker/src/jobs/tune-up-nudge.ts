import { db, schema } from "@najimi/db"
import { publish, topic } from "@najimi/live"
import { gte } from "drizzle-orm"

/** Today's tune-up is ready: one nudge each morning for everyone who used it in the last week. */
export async function tuneUpNudge() {
  const since = new Date(Date.now() - 7 * 86_400_000)
  const rows = await db
    .selectDistinct({ userId: schema.tuneUps.userId })
    .from(schema.tuneUps)
    .where(gte(schema.tuneUps.createdAt, since))
  for (const { userId } of rows) {
    const [note] = await db
      .insert(schema.notifications)
      .values({ userId, kind: "tuneup", data: { text: "Your five-minute feed tune-up is ready" } })
      .returning({ id: schema.notifications.id })
    await publish(topic.user(userId), "notification", { id: note?.id, kind: "tuneup" })
  }
  console.log(`[tune-up] nudged ${rows.length}`)
}
