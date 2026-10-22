import { setBooking } from "@najimi/agent/server"
import { book, bookingByReference } from "@najimi/booking/nuitee"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { bookingView, ownedBooking } from "@/lib/bookings"

type Holder = { firstName: string; lastName: string; email: string; phone: string }

/**
 * After Nuitee's payment sheet: books the room. Only one request can take a booking from
 * "prebooked" to "paid", so a double tap never books twice; a book that times out is looked up by
 * our own reference instead of being sent again.
 */
export async function POST(_: Request, ctx: RouteContext<"/api/bookings/[id]/complete">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const found = await ownedBooking(auth.session.user.id, (await ctx.params).id)
  if (!found) return fail("Unknown booking", 404)
  if (found.status !== "prebooked") return json({ booking: bookingView(found) })
  const holder = (found.data as { holder?: Holder }).holder
  if (!holder) return fail("Who is the room for?", 400)
  const [claimed] = await db
    .update(schema.bookings)
    .set({ status: "paid" })
    .where(and(eq(schema.bookings.id, found.id), eq(schema.bookings.status, "prebooked")))
    .returning()
  if (!claimed) {
    const now = await ownedBooking(auth.session.user.id, found.id)
    return json({ booking: now ? bookingView(now) : null })
  }
  const ref = claimed.ref as Record<string, string>
  const booked = await book({
    prebookId: ref.prebookId ?? "",
    transactionId: ref.transactionId ?? "",
    clientReference: ref.clientReference ?? claimed.id,
    holder,
  })
    .catch(async (error: Error) => {
      // Unknown, not failed: Nuitee may have booked it.
      const later = await bookingByReference(ref.clientReference ?? claimed.id).catch(() => null)
      if (later) return later
      throw error
    })
    .catch((error: Error) => error)
  if (booked instanceof Error) {
    const failed = await setBooking(
      claimed.id,
      { status: "failed", note: booked.message },
      `${claimed.title}: the booking didn't go through (${booked.message}). Nothing was booked.`,
    )
    return json({ booking: failed ? bookingView(failed) : null })
  }
  const checkout = new Date(`${booked.checkout}T10:00:00Z`)
  const done = await setBooking(
    claimed.id,
    {
      status: booked.status === "CONFIRMED" ? "confirmed" : "paid",
      amount: booked.price,
      currency: booked.currency,
      ref: { ...ref, bookingId: booked.bookingId, confirmation: booked.confirmation ?? "" },
      data: {
        ...(claimed.data as Record<string, unknown>),
        secretKey: undefined,
        refundable: booked.refundable,
        freeUntil: booked.freeUntil,
      },
      // The morning after checkout, Najimi asks how it was.
      followUpAt: new Date(checkout.getTime() + 24 * 3600_000),
    },
    `Booked: ${claimed.title}, ${booked.checkin} to ${booked.checkout}${booked.confirmation ? ` (confirmation ${booked.confirmation})` : ""}.`,
  )
  return json({ booking: done ? bookingView(done) : null })
}
