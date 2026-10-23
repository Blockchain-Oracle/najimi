import { calendarLinks } from "@najimi/booking/ics"
import { db, schema } from "@najimi/db"
import { bookingEmail, emailReady, sendEmail, unsubscribeUrl } from "@najimi/email"
import { env } from "@najimi/env/server"
import { eq } from "drizzle-orm"

/*
 * A booking's news also goes to its owner's inbox, drawn as its ticket: the outcome of a table
 * call (with its recording), a confirmed or failed stay, and the reminders before it. Only to a
 * real address (guests and some sign-ins carry a stand-in one), only when they want booking news,
 * once each.
 */

type Notification = typeof schema.notifications.$inferSelect

/** Someone's real address and email choices, or null when there's nothing to send to. */
export async function inbox(userId: string) {
  const [row] = await db
    .select({ email: schema.user.email, prefs: schema.userPrefs })
    .from(schema.user)
    .leftJoin(schema.userPrefs, eq(schema.userPrefs.userId, schema.user.id))
    .where(eq(schema.user.id, userId))
  if (!row?.email || row.email.endsWith(".invalid")) return null
  return { email: row.email, prefs: row.prefs }
}

/** What the ticket says it is, in a word, and whether that's good news. */
function verdict(b: typeof schema.bookings.$inferSelect, reminder: boolean) {
  if (reminder) return { label: "Reminder", tone: "plain" as const }
  if (b.status === "confirmed" || b.status === "paid" || b.status === "completed")
    return { label: b.kind === "hotel" ? "Stay confirmed" : "Table booked", tone: "good" as const }
  if (b.status === "failed" || b.status === "cancelled")
    return { label: b.status === "cancelled" ? "Cancelled" : "Not booked", tone: "bad" as const }
  return { label: "Booking", tone: "plain" as const }
}

export async function emailBooking(n: Notification) {
  const data = n.data as { bookingId?: unknown; text?: unknown; reminder?: unknown }
  if (!emailReady() || typeof data.bookingId !== "string") return
  const to = await inbox(n.userId)
  if (!to || to.prefs?.emailPrefs.news === false) return
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, data.bookingId))
  if (!b) return
  const text = String(data.text ?? "")
  const site = env.BETTER_AUTH_URL.replace(/\/$/, "")
  const extra = b.data as { when?: string; recording?: boolean }
  const chat = b.chatId ? `${site}/c/${b.chatId}` : `${site}/passport`
  const { label, tone } = verdict(b, typeof data.reminder === "string")
  const under = (b.ref as Record<string, string>).confirmation
  const facts = [
    b.kind === "table" && b.party ? { label: "Party", value: `${b.party}` } : null,
    under ? { label: "Under", value: under } : null,
    b.note && tone === "bad" ? { label: "What they said", value: b.note } : null,
  ].filter((f): f is { label: string; value: string } => Boolean(f))
  const calendar =
    tone !== "bad" && b.startsAt
      ? calendarLinks({
          uid: b.id,
          title: b.venue ? `${b.title} · ${b.venue}` : b.title,
          start: b.startsAt,
          end: b.endsAt ?? new Date(b.startsAt.getTime() + 2 * 3600_000),
          where: b.venue,
          notes: under ? `Booked through Najimi, under ${under}.` : "Booked through Najimi.",
        }).google
      : null
  const mail = bookingEmail({
    label,
    folio: `No. ${b.id.slice(0, 6).toUpperCase()}`,
    tone,
    headline: text.length > 90 ? `${text.slice(0, 87)}…` : text,
    text,
    venue: b.venue ?? b.title,
    when: extra.when ?? null,
    image: b.image,
    facts,
    open: chat,
    recording: extra.recording && b.chatId ? chat : null,
    calendar,
    unsubscribe: unsubscribeUrl(n.userId, "news"),
  })
  await sendEmail({ to: to.email, ...mail, idempotencyKey: `booking:${n.id}` })
}
