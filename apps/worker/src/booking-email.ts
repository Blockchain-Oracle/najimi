import { db, schema } from "@najimi/db"
import { bookingEmail, emailReady, sendEmail, unsubscribeUrl } from "@najimi/email"
import { env } from "@najimi/env/server"
import { eq } from "drizzle-orm"

/*
 * A booking's news also goes to its owner's inbox: the outcome of a table call (with its
 * recording), a confirmed or failed stay, and the reminders before it. Only to a real address
 * (guests and some sign-ins carry a stand-in one), only when they want booking news, once each.
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

export async function emailBooking(n: Notification) {
  const bookingId = (n.data as { bookingId?: unknown }).bookingId
  if (!emailReady() || typeof bookingId !== "string") return
  const to = await inbox(n.userId)
  if (!to || to.prefs?.emailPrefs.news === false) return
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (!b) return
  const text = String((n.data as { text?: unknown }).text ?? "")
  const site = env.BETTER_AUTH_URL.replace(/\/$/, "")
  const data = b.data as { when?: string; recording?: boolean }
  const chat = b.chatId ? `${site}/c/${b.chatId}` : `${site}/passport`
  const mail = bookingEmail({
    headline: text.length > 90 ? `${text.slice(0, 87)}…` : text,
    text,
    venue: b.venue ?? b.title,
    when: data.when ?? null,
    image: b.image,
    open: chat,
    recording: data.recording && b.chatId ? chat : null,
    unsubscribe: unsubscribeUrl(n.userId, "news"),
  })
  await sendEmail({ to: to.email, ...mail, idempotencyKey: `booking:${n.id}` })
}
