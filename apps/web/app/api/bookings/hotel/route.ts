import { charge, refund } from "@najimi/agent/server"
import { prebook } from "@najimi/booking/nuitee"
import { db, schema } from "@najimi/db"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { isMember } from "@/lib/chat/store"
import { allow } from "@/lib/rate-limit"

const input = z.object({
  offerId: z.string().min(4).max(400),
  hotel: z.object({
    hotelId: z.string().max(64),
    name: z.string().max(200),
    photo: z.string().url().max(600).nullable(),
    address: z.string().max(300).nullable(),
    stars: z.number().nullable(),
    rating: z.number().nullable(),
  }),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(8),
  chatId: z.uuid().optional(),
})

/**
 * Holds a room (Nuitee prebook): the price is locked and a payment opened in Nuitee's sheet. The
 * booking is saved at once with every id Nuitee gave (they can't be fetched again).
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`prebook:${me}`, 10, 60_000)) return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const { offerId, hotel, checkin, checkout, guests, chatId } = parsed.data
  if (chatId && !(await isMember(chatId, me))) return fail("Unknown room", 404)
  const guest = Boolean((auth.session.user as { isAnonymous?: boolean | null }).isAnonymous)
  if (!(await charge(me, guest, "holds")))
    return fail("That's all the rooms you can hold today. Try again tomorrow.", 429)
  try {
    const held = await prebook(offerId)
    const id = crypto.randomUUID()
    await db.insert(schema.bookings).values({
      id,
      ownerId: me,
      chatId: chatId ?? null,
      kind: "hotel",
      provider: "nuitee",
      status: "prebooked",
      title: hotel.name,
      venue: hotel.name,
      image: hotel.photo,
      startsAt: new Date(`${held.checkin ?? checkin}T14:00:00Z`),
      endsAt: new Date(`${held.checkout ?? checkout}T11:00:00Z`),
      party: guests,
      amount: held.price,
      currency: held.currency,
      ref: { prebookId: held.prebookId, transactionId: held.transactionId, clientReference: id },
      data: {
        secretKey: held.secretKey,
        hotelId: hotel.hotelId,
        address: hotel.address,
        stars: hotel.stars,
        rating: hotel.rating,
        refundable: held.refundable,
        freeUntil: held.freeUntil,
        changed: held.changed,
      },
    })
    return json({ bookingId: id }, 201)
  } catch (e) {
    await refund(me, "holds")
    return fail(e instanceof Error ? e.message : "Couldn't hold the room", 422)
  }
}
