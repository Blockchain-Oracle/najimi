import { db, schema } from "@najimi/db"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

const input = z.object({ userId: z.string().min(1).max(64) })

/**
 * Blocks someone (W25): they're gone from your search, twins, radar and map, can't open your
 * profile, follow or message you, and you stop following each other.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  const { userId } = parsed.data
  if (userId === me) return fail("That's you", 400)
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.blocks)
      .values({ blockerId: me, blockedId: userId })
      .onConflictDoNothing()
    await tx
      .delete(schema.follows)
      .where(
        or(
          and(eq(schema.follows.followerId, me), eq(schema.follows.followeeId, userId)),
          and(eq(schema.follows.followerId, userId), eq(schema.follows.followeeId, me)),
        ),
      )
  })
  return json({ ok: true })
}

/** Unblocks them (follows aren't restored). */
export async function DELETE(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  await db
    .delete(schema.blocks)
    .where(
      and(
        eq(schema.blocks.blockerId, auth.session.user.id),
        eq(schema.blocks.blockedId, parsed.data.userId),
      ),
    )
  return json({ ok: true })
}
