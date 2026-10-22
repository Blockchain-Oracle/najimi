import { applyCallResult, askHowItWent, askHowPlanWent, setBooking } from "@najimi/agent/server"
import { callResult } from "@najimi/booking/calls"
import { bookingById } from "@najimi/booking/nuitee"
import { db, schema } from "@najimi/db"
import { enqueueAt } from "@najimi/jobs"
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm"

/*
 * Bookings, followed (§4.7): a table call's result when its webhook didn't come, and afterwards
 * "How was it?" for every stay, table and night that has happened.
 */

const CALL_GIVE_UP_MS = 30 * 60_000
/** "How was it?" for a plan: 12 hours after it starts (or a trip ends), for plans in the last 3 days. */
const PLAN_AFTER_MS = 12 * 3600_000
const PLAN_RECENT_MS = 3 * 24 * 3600_000
/** A paid stay is checked with Nuitee every 10 minutes for a day, then handed to a person. */
const HOTEL_CHECK_MS = 10 * 60_000
const HOTEL_GIVE_UP_MS = 24 * 3600_000

export async function bookingCheck(bookingId: string) {
  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (booking?.status === "paid" && booking.kind === "hotel") return hotelCheck(booking)
  if (booking?.status !== "calling") return
  const conversationId = (booking.ref as Record<string, string>).conversationId
  if (!conversationId) return
  const result = await callResult(conversationId).catch(() => null)
  if (result?.status === "done" || result?.status === "failed") {
    await applyCallResult(booking, { ...result, status: "done" })
    return
  }
  // Still ringing or being summarised: look again shortly, up to half an hour, then say so.
  if (Date.now() - booking.createdAt.getTime() < CALL_GIVE_UP_MS)
    await enqueueAt("bookingCheck", { bookingId }, new Date(Date.now() + 3 * 60_000))
  else
    await setBooking(
      booking.id,
      { status: "failed", note: "no result from the call" },
      `I couldn't get a clear answer from the call to ${booking.venue ?? "the venue"}, so nothing is booked. Want me to try again?`,
    )
}

/** A stay that was paid but not yet confirmed: asked again until Nuitee settles it. */
async function hotelCheck(booking: typeof schema.bookings.$inferSelect) {
  const ref = booking.ref as Record<string, string>
  const found = ref.bookingId ? await bookingById(ref.bookingId).catch(() => null) : null
  const status = found?.status.toUpperCase()
  if (status === "CONFIRMED") {
    await setBooking(
      booking.id,
      { status: "confirmed", ref: { ...ref, confirmation: found?.confirmation ?? "" } },
      `Confirmed: ${booking.title}${found?.confirmation ? ` (confirmation ${found.confirmation})` : ""}.`,
    )
    return
  }
  if (status === "FAILED" || status?.startsWith("CANCEL")) {
    await setBooking(
      booking.id,
      { status: "failed", note: `Nuitee: ${status.toLowerCase()}` },
      `${booking.title}: the hotel didn't confirm, so the booking was not made. Nuitee returns the payment.`,
    )
    return
  }
  if (Date.now() - booking.createdAt.getTime() < HOTEL_GIVE_UP_MS) {
    await enqueueAt(
      "bookingCheck",
      { bookingId: booking.id },
      new Date(Date.now() + HOTEL_CHECK_MS),
    )
    return
  }
  await setBooking(
    booking.id,
    { note: "unconfirmed after a day" },
    `${booking.title} is paid but the hotel still hasn't confirmed after a day. Reply here and I'll chase it with Nuitee.`,
  )
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

  // Nights and trips that weren't booked through Najimi: the morning after (a trip: after its last
  // day). Only recent ones, so turning this on doesn't ask about last month.
  const now = Date.now()
  const plans = await db
    .select()
    .from(schema.plans)
    .where(
      and(
        inArray(schema.plans.status, ["draft", "booked"]),
        isNull(schema.plans.outcome),
        isNotNull(schema.plans.startsAt),
        lte(schema.plans.startsAt, new Date(now - PLAN_AFTER_MS)),
        gte(schema.plans.startsAt, new Date(now - PLAN_RECENT_MS)),
      ),
    )
    .limit(50)
  for (const plan of plans) {
    const ends =
      (plan.startsAt?.getTime() ?? 0) + (plan.kind === "trip" ? plan.days * 24 * 3600_000 : 0)
    if (ends + PLAN_AFTER_MS > now) continue
    const [own] = plan.chatId
      ? [null]
      : await db
          .select({ id: schema.chats.id })
          .from(schema.chats)
          .where(and(eq(schema.chats.ownerId, plan.ownerId), eq(schema.chats.kind, "agent")))
          .orderBy(desc(schema.chats.lastActiveAt))
          .limit(1)
    await askHowPlanWent(plan, own?.id ?? null).catch((e) =>
      console.error("[follow-up]", plan.id, e),
    )
  }
}
