import { icsOf } from "@najimi/booking"
import { fail, withSession } from "@/lib/api"
import { ownedBooking } from "@/lib/bookings"

/** A table's usual length, when the booking has no end. */
const TABLE_MS = 2 * 3600_000

/** A booking as a calendar file (its owner's): the stay from check-in to check-out, or the table. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const b = await ownedBooking(auth.session.user.id, (await ctx.params).id)
  if (!b?.startsAt) return fail("Unknown booking", 404)
  const confirmation = (b.ref as Record<string, string>).confirmation
  const ics = icsOf([
    {
      uid: `booking-${b.id}`,
      title: b.venue ?? b.title,
      start: b.startsAt,
      end: b.endsAt ?? new Date(b.startsAt.getTime() + TABLE_MS),
      where: b.venue,
      notes: [b.title, confirmation ? `Confirmation ${confirmation}` : null]
        .filter(Boolean)
        .join("\n"),
    },
  ])
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="najimi-booking-${b.id.slice(0, 8)}.ics"`,
    },
  })
}
