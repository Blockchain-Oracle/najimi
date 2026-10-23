import { REMINDERS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { BookingStatus } from "@najimi/db/schema"
import { enqueueAt } from "@najimi/jobs"
import { publish, topic } from "@najimi/live"
import { eq } from "drizzle-orm"
import type { BookingNote } from "../ui-message"
import { publishMessage, toUI } from "./room"

/*
 * A booking's life, told (§4.7): every change is saved, said in its room (when it was made in
 * one), and put in the owner's news. After it happens, Najimi asks how it was; the answer becomes
 * taste.
 */

type Booking = typeof schema.bookings.$inferSelect

/** The booking as a notice card shows it. */
const noteOf = (b: Booking): BookingNote => ({
  id: b.id,
  ownerId: b.ownerId,
  kind: b.kind,
  title: b.title,
  venue: b.venue,
  image: b.image,
  status: b.status,
  startsAt: b.startsAt?.toISOString() ?? null,
  endsAt: b.endsAt?.toISOString() ?? null,
  confirmation: (b.ref as Record<string, string>).confirmation || null,
  refundable: Boolean((b.data as { refundable?: boolean }).refundable),
  recording: Boolean((b.data as { recording?: boolean }).recording),
})

/** A card in the booking's room (its line and the booking as it is now), and the owner's news. */
export async function tellBooking(booking: Booking, text: string) {
  if (booking.chatId) {
    const [row] = await db
      .insert(schema.messages)
      .values({
        id: `sys_bk_${booking.id.slice(0, 8)}_${Date.now().toString(36)}`,
        chatId: booking.chatId,
        role: "system",
        parts: [{ type: "text", text }],
        metadata: { booking: noteOf(booking) },
      })
      .returning()
    if (row) await publishMessage(booking.chatId, toUI(row))
  }
  const [note] = await db
    .insert(schema.notifications)
    .values({
      userId: booking.ownerId,
      kind: "booking",
      chatId: booking.chatId,
      data: { bookingId: booking.id, text, name: booking.title },
    })
    .returning({ id: schema.notifications.id })
  await publish(topic.user(booking.ownerId), "notification", { id: note?.id, kind: "booking" })
}

/** A confirmed booking's reminders, the day before and a little before (whichever are still ahead). */
async function scheduleReminders(booking: Booking) {
  const start = booking.startsAt?.getTime()
  if (!start) return
  const now = Date.now()
  if (start - REMINDERS.dayBeforeMs > now + 60 * 60_000)
    await enqueueAt(
      "bookingReminder",
      { bookingId: booking.id, when: "day" },
      new Date(start - REMINDERS.dayBeforeMs),
    )
  if (start - REMINDERS.soonMs > now + 5 * 60_000)
    await enqueueAt(
      "bookingReminder",
      { bookingId: booking.id, when: "soon" },
      new Date(start - REMINDERS.soonMs),
    )
}

/** The reminder itself, in the booking's room and the owner's news (each kind once). */
export async function remindBooking(bookingId: string, when: "day" | "soon") {
  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (!booking?.startsAt || booking.startsAt.getTime() < Date.now()) return
  if (booking.status !== "confirmed" && booking.status !== "paid") return
  const data = booking.data as { when?: string; reminded?: string[] }
  if (data.reminded?.includes(when)) return
  await db
    .update(schema.bookings)
    .set({ data: { ...data, reminded: [...(data.reminded ?? []), when] } })
    .where(eq(schema.bookings.id, bookingId))
  const what = `${booking.title}${booking.party && booking.kind === "table" ? ` for ${booking.party}` : ""}`
  const under = (booking.ref as Record<string, string>).confirmation
  const at = data.when ? `, ${data.when}` : ""
  await tellBooking(
    booking,
    when === "day"
      ? `Tomorrow: ${what}${at}${under ? `, under ${under}` : ""}.`
      : `In two hours: ${what}${at}${under ? `, under ${under}` : ""}. Have a good one.`,
  )
}

/** Moves a booking on, and says so. */
export async function setBooking(
  id: string,
  patch: Partial<Omit<Booking, "id" | "ownerId" | "createdAt">> & { status?: BookingStatus },
  say?: string,
) {
  const [booking] = await db
    .update(schema.bookings)
    .set(patch)
    .where(eq(schema.bookings.id, id))
    .returning()
  if (booking && say) await tellBooking(booking, say)
  if (booking && patch.status === "confirmed") await scheduleReminders(booking)
  return booking ?? null
}

/**
 * "How was it?" as a card in the booking's room (or Najimi's own chat with them): their answer
 * resumes Najimi, who turns it into taste.
 */
export async function askHowItWent(booking: Booking, agentChatId: string | null) {
  const chatId = booking.chatId ?? agentChatId
  if (!chatId) return false
  const venue = booking.venue ?? booking.title
  const id = `msg_follow_${booking.id}`
  const [row] = await db
    .insert(schema.messages)
    .values({
      id,
      chatId,
      role: "assistant",
      status: "waiting",
      parts: [
        {
          type: "text",
          text: `${venue} was ${booking.kind === "hotel" ? "your stay" : "on the plan"}. How was it?`,
        },
        {
          type: "tool-askUser",
          toolCallId: `follow_${booking.id.slice(0, 12)}`,
          state: "input-available",
          input: {
            title: `How was ${venue}?`,
            steps: [
              {
                id: "outcome",
                question: `How was ${venue}?`,
                options: [
                  { id: "loved", label: "Loved it" },
                  { id: "fine", label: "It was fine" },
                  { id: "not", label: "Not for me" },
                  { id: "skipped", label: "We didn't go" },
                ],
              },
            ],
          },
        },
      ],
      metadata: { bookingId: booking.id, qlooId: booking.qlooId },
    })
    .onConflictDoNothing()
    .returning()
  if (row) {
    await publishMessage(chatId, toUI(row))
    await db
      .update(schema.chats)
      .set({ status: "waiting", lastActiveAt: new Date() })
      .where(eq(schema.chats.id, chatId))
  }
  await db
    .update(schema.bookings)
    .set({ followUpAt: null, status: "completed" })
    .where(eq(schema.bookings.id, booking.id))
  return Boolean(row)
}

type Plan = typeof schema.plans.$inferSelect

/**
 * The day after a night out (or the end of a trip) that wasn't booked through Najimi: the same
 * "How was it?" card in its room. The answer is kept on the plan; the Passport counts it then.
 */
export async function askHowPlanWent(plan: Plan, agentChatId: string | null) {
  const chatId = plan.chatId ?? agentChatId
  await db.update(schema.plans).set({ status: "done" }).where(eq(schema.plans.id, plan.id))
  if (!chatId) return false
  const what = plan.kind === "trip" ? `the trip to ${plan.city ?? plan.title}` : plan.title
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: `msg_follow_plan_${plan.id}`,
      chatId,
      role: "assistant",
      status: "waiting",
      parts: [
        { type: "text", text: `How was ${what}?` },
        {
          type: "tool-askUser",
          toolCallId: `follow_plan_${plan.id.slice(0, 12)}`,
          state: "input-available",
          input: {
            title: `How was ${what}?`,
            steps: [
              {
                id: "outcome",
                question: `How was ${what}?`,
                options: [
                  { id: "loved", label: "Loved it" },
                  { id: "fine", label: "It was fine" },
                  { id: "not", label: "Not for me" },
                  { id: "skipped", label: "We didn't go" },
                ],
              },
            ],
          },
        },
      ],
      metadata: { planId: plan.id },
    })
    .onConflictDoNothing()
    .returning()
  if (!row) return false
  await publishMessage(chatId, toUI(row))
  await db
    .update(schema.chats)
    .set({ status: "waiting", lastActiveAt: new Date() })
    .where(eq(schema.chats.id, chatId))
  return true
}

/** A table call's outcome, applied once (the webhook and the fallback check may both arrive). */
export async function applyCallResult(
  booking: Booking,
  result: {
    status: string
    booked: boolean | null
    summary: string | null
    confirmation: string | null
    offered: string | null
    voicemail?: boolean
    doNotCall?: boolean
    recording?: boolean
  },
) {
  if (booking.status !== "calling" || result.status !== "done") return booking
  const when = (booking.data as { when?: string }).when ?? ""
  const phone = (booking.data as { phone?: string }).phone ?? null
  // The call's audio, when ElevenLabs kept it, plays from the outcome card.
  const data = {
    ...(booking.data as Record<string, unknown>),
    recording: Boolean(result.recording),
  }
  const venue = booking.venue ?? "the venue"
  // They asked not to be called by an AI again: the number goes on the list for good.
  if (result.doNotCall && phone)
    await db.insert(schema.callBlocks).values({ phone, venue: booking.venue }).onConflictDoNothing()
  if (result.voicemail && !result.booked)
    return setBooking(
      booking.id,
      { status: "failed", note: "Reached voicemail", data },
      `I reached ${booking.venue ?? "the venue"}'s voicemail and hung up without leaving a message. Want me to try again later?`,
    )
  if (result.booked) {
    return setBooking(
      booking.id,
      {
        status: "confirmed",
        ref: {
          ...(booking.ref as Record<string, string>),
          confirmation: result.confirmation ?? "",
        },
        note: result.summary,
        data,
        // A few hours after the table, Najimi asks how it was.
        followUpAt: booking.startsAt ? new Date(booking.startsAt.getTime() + 3 * 3600_000) : null,
      },
      `Booked by phone: ${booking.title} for ${booking.party}, ${when}${result.confirmation ? `, under ${result.confirmation}` : ""}.`,
    )
  }
  // They spoke, but nobody said yes: never reported as booked, never as refused.
  if (result.booked === null && !result.offered)
    return setBooking(
      booking.id,
      { status: "failed", note: result.summary ?? "no clear answer", data },
      `I spoke to ${venue}, but they didn't confirm a table for ${when}, so nothing is booked.${result.summary ? ` ${result.summary}` : ""} Want me to try again?`,
    )
  return setBooking(
    booking.id,
    { status: "failed", note: result.summary, data },
    `${booking.venue ?? "The venue"} couldn't do ${when}${result.offered ? `; they offered ${result.offered}` : ""}.${result.summary ? ` ${result.summary}` : ""}${result.doNotCall ? " They asked not to be called by an AI again, so I won't call them." : ""}`,
  )
}

/** A call that never connected (busy, no answer). */
export async function callNotAnswered(booking: Booking, reason: string) {
  if (booking.status !== "calling") return booking
  const why =
    reason === "busy"
      ? "the line was busy"
      : reason === "failed" || reason === "canceled"
        ? "the call couldn't go through"
        : "nobody picked up"
  return setBooking(
    booking.id,
    { status: "failed", note: reason },
    `I called ${booking.venue ?? "the venue"} but ${why}, so nothing is booked. Want me to try again later?`,
  )
}
