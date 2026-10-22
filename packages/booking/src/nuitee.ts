import { env } from "@najimi/env/server"

/*
 * Hotels, booked for real (W18), through Nuitee Connect (LiteAPI v3). Nuitee is the merchant of
 * record: the guest pays in Nuitee's own payment sheet, and Najimi earns its margin. The flow:
 * rates near a spot → prebook (price held, payment intent made) → the guest pays → book. Every
 * id is kept the moment it exists (prebook ids can't be fetched again), a book that times out is
 * reconciled by its client reference, never re-sent.
 * Shapes from Nuitee's published OpenAPI specs (api-search.json, api-booking.json), 2026-10-22.
 */

const SEARCH = "https://api.liteapi.travel/v3.0"
const BOOK = "https://book.liteapi.travel/v3.0"

export const hotelsOn = () => Boolean(env.NUITEE_API_KEY)
/** The payment sheet's mode follows the key Nuitee issued (live keys start `prod_`). */
export const paymentMode = () => (env.NUITEE_API_KEY?.startsWith("sand_") ? "sandbox" : "live")

type Money = { amount: number; currency: string }
/** Nuitee gives money as a list in some answers and a single object in others. */
const moneyOf = (m: Money | Money[] | undefined | null): Money | null =>
  Array.isArray(m) ? (m[0] ?? null) : (m ?? null)

async function call<T>(
  base: string,
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
) {
  if (!env.NUITEE_API_KEY) throw new Error("Hotel booking isn't connected yet")
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "X-API-Key": env.NUITEE_API_KEY,
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
  })
  const text = await res.text()
  const body = text
    ? (JSON.parse(text) as T & { error?: { message?: string; description?: string } })
    : null
  if (!res.ok || !body) {
    const message =
      body?.error?.message ?? body?.error?.description ?? `Nuitee answered ${res.status}`
    throw new Error(message)
  }
  return body
}

export type HotelOffer = {
  hotelId: string
  name: string
  photo: string | null
  address: string | null
  lat: number | null
  lon: number | null
  stars: number | null
  rating: number | null
  reviews: number | null
  offerId: string
  room: string | null
  board: string | null
  price: Money
  refundable: boolean
}

type RatesBody = {
  data?: {
    hotelId: string
    roomTypes?: {
      offerId: string
      name?: string
      offerRetailRate?: Money[] | Money
      rates?: {
        name?: string
        boardName?: string
        retailRate?: { total?: Money[] | Money }
        cancellationPolicies?: { refundableTag?: "RFN" | "NRFN" }
      }[]
    }[]
  }[]
  hotels?: {
    id: string
    name: string
    main_photo?: string
    thumbnail?: string
    address?: string
    latitude?: number
    longitude?: number
    rating?: number
    stars?: number
    review_count?: number
  }[]
}

/** The cheapest room at each hotel near a spot, for these dates and guests. */
export async function hotelsNear(input: {
  lat: number
  lon: number
  radiusMeters?: number
  checkin: string
  checkout: string
  adults: number
  currency?: string
  /** ISO-2 of the guest's nationality (rates can depend on it). */
  nationality?: string
  limit?: number
}): Promise<HotelOffer[]> {
  const body = await call<RatesBody>(SEARCH, "/hotels/rates", {
    body: {
      latitude: input.lat,
      longitude: input.lon,
      radius: Math.max(1000, input.radiusMeters ?? 3000),
      checkin: input.checkin,
      checkout: input.checkout,
      occupancies: [{ adults: Math.max(1, Math.min(8, input.adults)), children: [] }],
      currency: input.currency ?? "USD",
      guestNationality: input.nationality ?? "NG",
      maxRatesPerHotel: 1,
      includeHotelData: true,
      margin: env.NUITEE_MARGIN,
      timeout: 8,
      limit: input.limit ?? 20,
    },
    timeoutMs: 25_000,
  })
  const hotels = new Map((body.hotels ?? []).map((h) => [h.id, h]))
  return (body.data ?? []).flatMap((row) => {
    const room = row.roomTypes?.[0]
    const rate = room?.rates?.[0]
    const price = moneyOf(room?.offerRetailRate) ?? moneyOf(rate?.retailRate?.total)
    const hotel = hotels.get(row.hotelId)
    if (!room || !price || !hotel) return []
    return [
      {
        hotelId: row.hotelId,
        name: hotel.name,
        photo: hotel.main_photo ?? hotel.thumbnail ?? null,
        address: hotel.address ?? null,
        lat: hotel.latitude ?? null,
        lon: hotel.longitude ?? null,
        stars: hotel.stars ?? null,
        rating: hotel.rating ?? null,
        reviews: hotel.review_count ?? null,
        offerId: room.offerId,
        room: rate?.name ?? room.name ?? null,
        board: rate?.boardName ?? null,
        price,
        refundable: rate?.cancellationPolicies?.refundableTag === "RFN",
      },
    ]
  })
}

export type Prebook = {
  prebookId: string
  transactionId: string
  /** The payment sheet's client secret (Stripe, on Nuitee's account). */
  secretKey: string
  hotelId: string
  checkin: string
  checkout: string
  price: number
  currency: string
  refundable: boolean
  /** Free cancellation until (ISO), when there is any. */
  freeUntil: string | null
  /** The price, the cancellation or the board changed since the rates: show it before paying. */
  changed: { pricePercent: number; cancellation: boolean; board: boolean }
}

/** Holds the price and opens the payment (Nuitee's sheet takes the card). */
export async function prebook(offerId: string): Promise<Prebook> {
  const body = await call<{
    data?: {
      prebookId: string
      transactionId?: string
      secretKey?: string
      hotelId: string
      checkin: string
      checkout: string
      price: number
      currency: string
      priceDifferencePercent?: number
      cancellationChanged?: boolean
      boardChanged?: boolean
      roomTypes?: {
        rates?: {
          cancellationPolicies?: {
            refundableTag?: "RFN" | "NRFN"
            cancelPolicyInfos?: { cancelTime?: string; amount?: number }[]
          }
        }[]
      }[]
    }
  }>(BOOK, "/rates/prebook", { body: { offerId, usePaymentSdk: true }, timeoutMs: 30_000 })
  const d = body.data
  if (!d?.prebookId || !d.transactionId || !d.secretKey)
    throw new Error("Nuitee couldn't hold this room")
  const policy = d.roomTypes?.[0]?.rates?.[0]?.cancellationPolicies
  const free = policy?.cancelPolicyInfos?.find((p) => (p.amount ?? 0) > 0)?.cancelTime ?? null
  return {
    prebookId: d.prebookId,
    transactionId: d.transactionId,
    secretKey: d.secretKey,
    hotelId: d.hotelId,
    checkin: d.checkin,
    checkout: d.checkout,
    price: d.price,
    currency: d.currency,
    refundable: policy?.refundableTag === "RFN",
    freeUntil: policy?.refundableTag === "RFN" ? free : null,
    changed: {
      pricePercent: d.priceDifferencePercent ?? 0,
      cancellation: Boolean(d.cancellationChanged),
      board: Boolean(d.boardChanged),
    },
  }
}

export type BookedHotel = {
  bookingId: string
  status: string
  confirmation: string | null
  hotelName: string | null
  checkin: string
  checkout: string
  price: number
  currency: string
  refundable: boolean
  freeUntil: string | null
}

type BookingData = {
  bookingId: string
  status: string
  hotelConfirmationCode?: string
  hotel?: { name?: string }
  checkin: string
  checkout: string
  price: number
  currency: string
  tag?: "RFN" | "NRFN"
  lastFreeCancellationDate?: string
}

const bookedOf = (d: BookingData): BookedHotel => ({
  bookingId: d.bookingId,
  status: d.status,
  confirmation: d.hotelConfirmationCode ?? null,
  hotelName: d.hotel?.name ?? null,
  checkin: d.checkin,
  checkout: d.checkout,
  price: d.price,
  currency: d.currency,
  refundable: d.tag === "RFN",
  freeUntil: d.lastFreeCancellationDate ?? null,
})

/** Books once paid. A timeout means "unknown", so the caller reconciles by client reference. */
export async function book(input: {
  prebookId: string
  transactionId: string
  clientReference: string
  holder: { firstName: string; lastName: string; email: string; phone: string }
}): Promise<BookedHotel> {
  const body = await call<{ data?: BookingData }>(BOOK, "/rates/book?timeout=110", {
    body: {
      prebookId: input.prebookId,
      clientReference: input.clientReference,
      holder: input.holder,
      guests: [{ occupancyNumber: 1, ...input.holder }],
      payment: { method: "TRANSACTION_ID", transactionId: input.transactionId },
    },
    timeoutMs: 120_000,
  })
  if (!body.data?.bookingId) throw new Error("Nuitee didn't confirm the booking")
  return bookedOf(body.data)
}

/** A booking by our own reference (after a book that timed out). */
export async function bookingByReference(clientReference: string): Promise<BookedHotel | null> {
  const body = await call<{ data?: BookingData[] }>(
    BOOK,
    `/bookings?clientReference=${encodeURIComponent(clientReference)}`,
  )
  const found = body.data?.[0]
  return found ? bookedOf(found) : null
}

export async function bookingById(bookingId: string): Promise<BookedHotel> {
  const body = await call<{ data?: BookingData }>(
    BOOK,
    `/bookings/${encodeURIComponent(bookingId)}`,
  )
  if (!body.data) throw new Error("Nuitee has no such booking")
  return bookedOf(body.data)
}

/** Cancels a booking; what's refunded follows the room's cancellation policy. */
export async function cancelBooking(bookingId: string) {
  const body = await call<{
    data?: { status: string; cancellation_fee?: number; refund_amount?: number; currency?: string }
  }>(BOOK, `/bookings/${encodeURIComponent(bookingId)}`, { method: "PUT" })
  return {
    status: body.data?.status ?? "CANCELLED",
    fee: body.data?.cancellation_fee ?? 0,
    refund: body.data?.refund_amount ?? 0,
    currency: body.data?.currency ?? null,
  }
}
