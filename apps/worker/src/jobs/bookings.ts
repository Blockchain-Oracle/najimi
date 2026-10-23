import {
  applyCallResult,
  askHowItWent,
  askHowPlanWent,
  callNotAnswered,
  setBooking,
} from "@najimi/agent/server"
import { callResult, lineStatus } from "@najimi/booking/calls"
import { bookingById } from "@najimi/booking/nuitee"
import { db, schema } from "@najimi/db"
import { enqueueAt } from "@najimi/jobs"
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm"

/*
 * Bookings, followed (§4.7): a table call's result when its webhook didn't come, and afterwards
 * "How was it?" for every stay, table and night that has happened.
 */

const CALL_GIVE_UP_MS = 30 * 60_000
/** While the phone rings it's checked every minute; once it's over, every half minute. */
const RINGING_CHECK_MS = 60_000
const WRAP_UP_CHECK_MS = 30_000
/** A finished call ElevenLabs hasn't written up after this long is reported as it stands. */
const WRAP_UP_MAX_MS = 10 * 60_000
/** Lines that never connected, and what Najimi says about each. */
const UNANSWERED = new Set(["busy", "no-answer", "failed", "canceled"])
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
  const ref = booking.ref as Record<string, string>
  const line = ref.callSid ? await lineStatus(ref.callSid).catch(() => null) : null
  // It never connected (busy, nobody picked up, it couldn't go through): say so now.
  if (line && UNANSWERED.has(line.status)) {
    await callNotAnswered(booking, line.status)
    return
  }
  const result = ref.conversationId ? await callResult(ref.conversationId).catch(() => null) : null
  if (result?.status === "done" || result?.status === "failed") {
    await applyCallResult(booking, { ...result, status: "done" })
    return
  }
  // It was answered and is over, but never written up: report what's known (and the recording).
  if (
    line?.status === "completed" &&
    line.endedAt &&
    Date.now() - line.endedAt.getTime() > WRAP_UP_MAX_MS
  ) {
    await applyCallResult(booking, {
      status: "done",
      booked: null,
      summary: null,
      confirmation: null,
      offered: null,
      recording: result?.recording ?? false,
    })
    return
  }
  // Still ringing, talking or being written up: look again shortly, up to half an hour.
  if (Date.now() - booking.createdAt.getTime() < CALL_GIVE_UP_MS)
    await enqueueAt(
      "bookingCheck",
      { bookingId },
      new Date(Date.now() + (line?.status === "completed" ? WRAP_UP_CHECK_MS : RINGING_CHECK_MS)),
    )
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
  // A safety net: any table call still "calling" a few minutes on is checked now.
  const ringing = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.status, "calling"),
        lte(schema.bookings.createdAt, new Date(Date.now() - 3 * 60_000)),
      ),
    )
    .limit(50)
  for (const { id } of ringing)
    await bookingCheck(id).catch((e) => console.error("[bookings] call check", e))
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
