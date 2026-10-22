import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { blockedWith, notify, relation } from "@/lib/social"

const input = z.object({ userId: z.string().min(1).max(64) })

/** Follow someone (they hear about it); following each other makes you friends. */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  const { userId } = parsed.data
  if (userId === me) return fail("That's you", 400)
  const [other] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
  if (!other || (await blockedWith(me)).has(userId)) return fail("Unknown person", 404)
  const added = await db
    .insert(schema.follows)
    .values({ followerId: me, followeeId: userId })
    .onConflictDoNothing()
    .returning({ at: schema.follows.createdAt })
  if (added.length) await notify({ userId, kind: "follow", actorId: me })
  return json({ ok: true, ...(await relation(me, userId)) })
}

export async function DELETE(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  await db
    .delete(schema.follows)
    .where(
      and(eq(schema.follows.followerId, me), eq(schema.follows.followeeId, parsed.data.userId)),
    )
  return json({ ok: true, ...(await relation(me, parsed.data.userId)) })
}
