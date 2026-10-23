import { connectionsOf, viewOf } from "@najimi/connectors/sessions"
import { db, schema } from "@najimi/db"
import { and, count, desc, eq, gte, inArray, isNull, max } from "drizzle-orm"
import { json, withSession } from "@/lib/api"

const MONTH_MS = 30 * 86_400_000

/**
 * Your agents: what acts on your own accounts (follow, like, post, per platform, with what each did
 * lately and the drafts waiting for you), and the routines Najimi runs for you on its own (the
 * morning tune-up, circle games, business plans, follow-ups, download reminders).
 */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const since = new Date(Date.now() - MONTH_MS)
  const [connections, actions, drafts, tune, circles, businesses, followUps, downloads] =
    await Promise.all([
      connectionsOf(me),
      db
        .select()
        .from(schema.socialActions)
        .where(
          and(
            eq(schema.socialActions.userId, me),
            gte(schema.socialActions.createdAt, since),
            inArray(schema.socialActions.kind, ["follow", "like", "post"]),
          ),
        )
        .orderBy(desc(schema.socialActions.createdAt))
        .limit(60),
      db
        .select()
        .from(schema.postDrafts)
        .where(eq(schema.postDrafts.userId, me))
        .orderBy(desc(schema.postDrafts.createdAt))
        .limit(8),
      db
        .select({ last: max(schema.tuneUps.createdAt) })
        .from(schema.tuneUps)
        .where(eq(schema.tuneUps.userId, me)),
      db
        .select({ n: count() })
        .from(schema.chatMembers)
        .innerJoin(schema.chats, eq(schema.chats.id, schema.chatMembers.chatId))
        .where(and(eq(schema.chatMembers.userId, me), eq(schema.chats.kind, "circle"))),
      db
        .select({ n: count(), last: max(schema.businesses.checkedAt) })
        .from(schema.businesses)
        .where(eq(schema.businesses.ownerId, me)),
      db
        .select({ n: count() })
        .from(schema.bookings)
        .where(and(eq(schema.bookings.ownerId, me), gte(schema.bookings.startsAt, since))),
      db
        .select({
          platform: schema.exportRequests.platform,
          readyAt: schema.exportRequests.readyAt,
        })
        .from(schema.exportRequests)
        .where(and(eq(schema.exportRequests.userId, me), isNull(schema.exportRequests.nudgedAt))),
    ])
  return json({
    connections: connections.map(viewOf),
    actions: actions.map((a) => ({
      id: a.id,
      platform: a.platform,
      kind: a.kind,
      label: a.label ?? a.target,
      status: a.status,
      detail: a.detail,
      url: a.url,
      at: a.createdAt.toISOString(),
    })),
    drafts: drafts.map((d) => ({
      id: d.id,
      platform: d.platform,
      text: d.text,
      status: d.status,
      url: d.url,
      detail: d.detail,
      at: d.createdAt.toISOString(),
    })),
    routines: {
      tuneUp: tune[0]?.last?.toISOString() ?? null,
      circles: circles[0]?.n ?? 0,
      businesses: businesses[0]?.n ?? 0,
      businessesChecked: businesses[0]?.last?.toISOString() ?? null,
      bookings: followUps[0]?.n ?? 0,
      downloads: downloads.map((d) => ({ platform: d.platform, readyAt: d.readyAt.toISOString() })),
    },
  })
}
