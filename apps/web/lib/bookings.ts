import "server-only"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"

/** A booking its owner may act on. */
export async function ownedBooking(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const [row] = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, id), eq(schema.bookings.ownerId, userId)))
  return row ?? null
}

/** What a page may show of a booking (never the payment secret). */
export function bookingView(b: typeof schema.bookings.$inferSelect) {
  const { secretKey: _s, ...data } = b.data as Record<string, unknown>
  return {
    id: b.id,
    kind: b.kind,
    provider: b.provider,
    status: b.status,
    title: b.title,
    venue: b.venue,
    image: b.image,
    startsAt: b.startsAt?.toISOString() ?? null,
    endsAt: b.endsAt?.toISOString() ?? null,
    party: b.party,
    amount: b.amount,
    currency: b.currency,
    note: b.note,
    confirmation: (b.ref as Record<string, string>).confirmation ?? null,
    data,
  }
}
export type BookingView = ReturnType<typeof bookingView>
