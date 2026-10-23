import { EXPORTS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { body, json, withSession } from "@/lib/api"

const input = z.object({ platform: z.enum(["x", "instagram", "tiktok", "youtube", "spotify"]) })

/** The data downloads you asked for from Najimi, and when each is usually ready. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const rows = await db
    .select()
    .from(schema.exportRequests)
    .where(eq(schema.exportRequests.userId, auth.session.user.id))
  return json({
    requests: rows.map((r) => ({
      platform: r.platform,
      requestedAt: r.requestedAt.toISOString(),
      readyAt: r.readyAt.toISOString(),
    })),
  })
}

/**
 * You opened a platform's download page from Najimi: remember it, so Najimi can remind you when
 * the file is usually ready. Asking again starts the clock again.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const { platform } = parsed.data
  const now = new Date()
  const readyAt = new Date(now.getTime() + EXPORTS.waitHours[platform] * 3600_000)
  await db
    .insert(schema.exportRequests)
    .values({ userId: auth.session.user.id, platform, requestedAt: now, readyAt })
    .onConflictDoUpdate({
      target: [schema.exportRequests.userId, schema.exportRequests.platform],
      set: { requestedAt: now, readyAt, nudgedAt: null },
    })
  return json({ platform, requestedAt: now.toISOString(), readyAt: readyAt.toISOString() })
}
