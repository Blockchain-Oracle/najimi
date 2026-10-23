import { db, schema } from "@najimi/db"
import { bookingEmail, emailReady, sendEmail } from "@najimi/email"
import { env } from "@najimi/env/server"
import { eq } from "drizzle-orm"

/*
 * A booking's news also goes to its owner's inbox: the outcome of a table call (with its
 * recording), a confirmed or failed stay, and the reminders before it. Only to a real address
 * (guests and some sign-ins carry a stand-in one), and only when email is set up.
 */

type Notification = typeof schema.notifications.$inferSelect

export async function emailBooking(n: Notification) {
  const bookingId = (n.data as { bookingId?: unknown }).bookingId
  if (!emailReady() || typeof bookingId !== "string") return
  const [owner] = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, n.userId))
  if (!owner?.email || owner.email.endsWith(".invalid")) return
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId))
  if (!b) return
  const text = String((n.data as { text?: unknown }).text ?? "")
  const site = env.BETTER_AUTH_URL.replace(/\/$/, "")
  const data = b.data as { when?: string; recording?: boolean }
  const mail = bookingEmail({
    headline: text.length > 90 ? `${text.slice(0, 87)}…` : text,
    text,
    venue: b.venue ?? b.title,
    when: data.when ?? null,
    image: b.image,
    open: b.chatId ? `${site}/c/${b.chatId}` : `${site}/passport`,
    recording: data.recording && b.chatId ? `${site}/c/${b.chatId}` : null,
  })
  await sendEmail({ to: owner.email, ...mail })
}
