import { applyCallResult, askHowItWent } from "@najimi/agent/server"
import { callResult } from "@najimi/booking/calls"
import { db, schema } from "@najimi/db"
import { enqueueAt } from "@najimi/jobs"
import { and, desc, eq, inArray, isNotNull, lte } from "drizzle-orm"

/*
 * Bookings, followed (§4.7): a table call's result when its webhook didn't come, and afterwards
 * "How was it?" for every stay, table and night that has happened.
 */

const CALL_GIVE_UP_MS = 30 * 60_000

export async function bookingCheck(bookingId: string) {
  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (booking?.status !== "calling") return
  const conversationId = (booking.ref as Record<string, string>).conversationId
  if (!conversationId) return
  const result = await callResult(conversationId).catch(() => null)
  if (result?.status === "done" || result?.status === "failed") {
    await applyCallResult(booking, { ...result, status: "done" })
    return
  }
  // Still ringing or being summarised: look again shortly, up to half an hour.
  if (Date.now() - booking.createdAt.getTime() < CALL_GIVE_UP_MS)
    await enqueueAt("bookingCheck", { bookingId }, new Date(Date.now() + 3 * 60_000))
}

export async function followUps() {
  const due = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        isNotNull(schema.bookings.followUpAt),
        lte(schema.bookings.followUpAt, new Date()),
        inArray(schema.bookings.status, ["confirmed", "paid"]),
      ),
    )
    .limit(50)
  for (const booking of due) {
    // In the room it was made in, or Najimi's own chat with them.
    const [own] = booking.chatId
      ? [null]
      : await db
          .select({ id: schema.chats.id })
          .from(schema.chats)
          .where(and(eq(schema.chats.ownerId, booking.ownerId), eq(schema.chats.kind, "agent")))
          .orderBy(desc(schema.chats.lastActiveAt))
          .limit(1)
    await askHowItWent(booking, own?.id ?? null).catch((e) =>
      console.error("[follow-up]", booking.id, e),
    )
  }
}
