import { db, schema } from "@najimi/db"
import type { BookingStatus } from "@najimi/db/schema"
import { publish, topic } from "@najimi/live"
import { eq } from "drizzle-orm"
import { publishMessage, toUI } from "./room"

/*
 * A booking's life, told (§4.7): every change is saved, said in its room (when it was made in
 * one), and put in the owner's news. After it happens, Najimi asks how it was; the answer becomes
 * taste.
 */

type Booking = typeof schema.bookings.$inferSelect

/** A line in the booking's room, and the owner's news. */
export async function tellBooking(booking: Booking, text: string) {
  if (booking.chatId) {
    const [row] = await db
      .insert(schema.messages)
      .values({
        id: `sys_bk_${booking.id.slice(0, 8)}_${Date.now().toString(36)}`,
        chatId: booking.chatId,
        role: "system",
        parts: [{ type: "text", text }],
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

/** A table call's outcome, applied once (the webhook and the fallback check may both arrive). */
export async function applyCallResult(
  booking: Booking,
  result: {
    status: string
    booked: boolean | null
    summary: string | null
    confirmation: string | null
    offered: string | null
  },
) {
  if (booking.status !== "calling" || result.status !== "done") return booking
  const when = (booking.data as { when?: string }).when ?? ""
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
        // A few hours after the table, Najimi asks how it was.
        followUpAt: booking.startsAt ? new Date(booking.startsAt.getTime() + 3 * 3600_000) : null,
      },
      `Booked by phone: ${booking.title} for ${booking.party}, ${when}${result.confirmation ? `, under ${result.confirmation}` : ""}.`,
    )
  }
  return setBooking(
    booking.id,
    { status: "failed", note: result.summary },
    `${booking.venue ?? "The venue"} couldn't do ${when}${result.offered ? `; they offered ${result.offered}` : ""}.${result.summary ? ` ${result.summary}` : ""}`,
  )
}

/** A call that never connected (busy, no answer). */
export async function callNotAnswered(booking: Booking, reason: string) {
  if (booking.status !== "calling") return booking
  return setBooking(
    booking.id,
    { status: "failed", note: reason },
    `I called ${booking.venue ?? "the venue"} but ${reason === "busy" ? "the line was busy" : "nobody answered"}. Want me to try again later?`,
  )
}
