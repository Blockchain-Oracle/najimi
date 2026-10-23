import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { isMember } from "@/lib/chat/store"

/** Where a booking stands, for its owner or anyone in the chat it was made in (the call card). */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const id = (await ctx.params).id
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown booking", 404)
  const [b] = await db
    .select({
      ownerId: schema.bookings.ownerId,
      chatId: schema.bookings.chatId,
      status: schema.bookings.status,
      data: schema.bookings.data,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
  const me = auth.session.user.id
  if (!b || (b.ownerId !== me && !(b.chatId && (await isMember(b.chatId, me)))))
    return fail("Unknown booking", 404)
  // While the phone is ringing, the caller's latest word on how it's going ("checking the book").
  const live = b.status === "calling" ? ((b.data as { live?: string }).live ?? null) : null
  return json({ status: b.status, live })
}
