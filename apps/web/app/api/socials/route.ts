import { bridgeReady } from "@najimi/connectors/bridge"
import { connectionsOf, vaultReady, viewOf } from "@najimi/connectors/sessions"
import { db, schema } from "@najimi/db"
import { lastEventId, topic } from "@najimi/live"
import { desc, eq } from "drizzle-orm"
import { json, withSession } from "@/lib/api"

/** Someone's connected accounts, what each can do here, and what Najimi did with them lately. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const [connections, actions, after] = await Promise.all([
    connectionsOf(me),
    db
      .select({
        id: schema.socialActions.id,
        platform: schema.socialActions.platform,
        kind: schema.socialActions.kind,
        target: schema.socialActions.target,
        label: schema.socialActions.label,
        status: schema.socialActions.status,
        detail: schema.socialActions.detail,
        url: schema.socialActions.url,
        createdAt: schema.socialActions.createdAt,
      })
      .from(schema.socialActions)
      .where(eq(schema.socialActions.userId, me))
      .orderBy(desc(schema.socialActions.createdAt))
      .limit(30),
    lastEventId(topic.user(me)),
  ])
  return json({
    ready: { x: vaultReady(), instagram: vaultReady() && bridgeReady() },
    connections: connections.map(viewOf),
    actions,
    after,
  })
}
