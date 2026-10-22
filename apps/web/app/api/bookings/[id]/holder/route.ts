import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedBooking } from "@/lib/bookings"

const input = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/),
})

/** Who the room is for (the hotel needs a name, an email and a phone). */
export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[id]/holder">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const booking = await ownedBooking(auth.session.user.id, (await ctx.params).id)
  if (!booking) return fail("Unknown booking", 404)
  if (booking.status !== "prebooked") return fail("This booking has moved on", 409)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  await db
    .update(schema.bookings)
    .set({ data: { ...(booking.data as Record<string, unknown>), holder: parsed.data } })
    .where(eq(schema.bookings.id, booking.id))
  return json({ ok: true })
}
