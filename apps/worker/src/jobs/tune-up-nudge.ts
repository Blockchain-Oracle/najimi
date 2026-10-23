import { db, schema } from "@najimi/db"
import { publish, topic } from "@najimi/live"
import { and, eq, gte } from "drizzle-orm"
import { hourIn } from "../local-time"

/** The local hour the morning tune-up nudge goes out. */
const NUDGE_HOUR = 8

/**
 * Today's tune-up is ready: one nudge on each person's own morning (the job runs hourly), for
 * everyone who used it in the last week.
 */
export async function tuneUpNudge() {
  const since = new Date(Date.now() - 7 * 86_400_000)
  const rows = await db
    .selectDistinct({ userId: schema.tuneUps.userId, tz: schema.userPrefs.tz })
    .from(schema.tuneUps)
    .leftJoin(schema.userPrefs, eq(schema.userPrefs.userId, schema.tuneUps.userId))
    .where(gte(schema.tuneUps.createdAt, since))
  let nudged = 0
  for (const { userId, tz } of rows) {
    if (hourIn(tz) !== NUDGE_HOUR) continue
    const [already] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.kind, "tuneup"),
          gte(schema.notifications.createdAt, new Date(Date.now() - 20 * 3600_000)),
        ),
      )
    if (already) continue
    const [note] = await db
      .insert(schema.notifications)
      .values({ userId, kind: "tuneup", data: { text: "Your five-minute feed tune-up is ready" } })
      .returning({ id: schema.notifications.id })
    await publish(topic.user(userId), "notification", { id: note?.id, kind: "tuneup" })
    nudged++
  }
  if (nudged) console.log(`[tune-up] nudged ${nudged}`)
}
