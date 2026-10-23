import { db, schema } from "@najimi/db"
import type { ExportSource } from "@najimi/db/schema"
import { publish, topic } from "@najimi/live"
import { and, eq, isNull, lte } from "drizzle-orm"

const NAMES: Record<ExportSource, string> = {
  x: "X archive",
  instagram: "Instagram download",
  tiktok: "TikTok data",
  youtube: "Google Takeout",
  spotify: "Spotify data",
}

/**
 * Data downloads asked for from Najimi that are usually ready by now: one reminder each, which
 * opens the right sheet to bring the file in (bringing it in clears the request).
 */
export async function exportNudges() {
  const due = await db
    .select()
    .from(schema.exportRequests)
    .where(
      and(lte(schema.exportRequests.readyAt, new Date()), isNull(schema.exportRequests.nudgedAt)),
    )
    .limit(500)
  for (const r of due) {
    const [note] = await db
      .insert(schema.notifications)
      .values({
        userId: r.userId,
        kind: "export",
        data: {
          text: `Your ${NAMES[r.platform]} is usually ready by now. Bring it in to Najimi.`,
          platform: r.platform,
        },
      })
      .returning({ id: schema.notifications.id })
    await db
      .update(schema.exportRequests)
      .set({ nudgedAt: new Date() })
      .where(eq(schema.exportRequests.id, r.id))
    await publish(topic.user(r.userId), "notification", { id: note?.id, kind: "export" })
  }
  if (due.length) console.log(`[exports] reminded ${due.length}`)
}
