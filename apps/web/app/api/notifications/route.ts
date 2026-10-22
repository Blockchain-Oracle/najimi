import { db, schema } from "@najimi/db"
import { and, desc, eq, isNull } from "drizzle-orm"
import { json, withSession } from "@/lib/api"
import { cardsOf } from "@/lib/social"

/** Your news, newest first, with who did each thing. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, me))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50)
  const actors = new Map(
    (await cardsOf([...new Set(rows.flatMap((r) => (r.actorId ? [r.actorId] : [])))])).map((c) => [
      c.userId,
      c,
    ]),
  )
  return json({
    unread: rows.filter((r) => !r.readAt).length,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      chatId: r.chatId,
      data: r.data,
      read: Boolean(r.readAt),
      at: r.createdAt,
      actor: r.actorId ? (actors.get(r.actorId) ?? null) : null,
    })),
  })
}

/** Marks everything read (opening the inbox). */
export async function POST() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, auth.session.user.id),
        isNull(schema.notifications.readAt),
      ),
    )
  return json({ ok: true })
}
