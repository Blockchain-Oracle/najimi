import { setBooking } from "@najimi/agent/server"
import { cancelBooking } from "@najimi/booking/nuitee"
import { fail, json, withSession } from "@/lib/api"
import { bookingView, ownedBooking } from "@/lib/bookings"

/** Cancels a hotel booking; what comes back follows the room's cancellation policy. */
export async function POST(_: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const booking = await ownedBooking(auth.session.user.id, (await ctx.params).id)
  if (!booking) return fail("Unknown booking", 404)
  if (booking.kind !== "hotel" || !["confirmed", "paid"].includes(booking.status))
    return fail("This booking can't be cancelled here", 409)
  const id = (booking.ref as Record<string, string>).bookingId
  if (!id) return fail("Nuitee hasn't confirmed this booking yet", 409)
  try {
    const r = await cancelBooking(id)
    const refund = r.refund
      ? `${r.refund} ${r.currency ?? booking.currency ?? ""} back`
      : "no refund"
    const done = await setBooking(
      booking.id,
      {
        status: "cancelled",
        note: r.fee ? `Cancelled with a ${r.fee} fee` : "Cancelled",
        followUpAt: null,
      },
      `Cancelled: ${booking.title} (${refund}).`,
    )
    return json({ booking: done ? bookingView(done) : null })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't cancel", 422)
  }
}
