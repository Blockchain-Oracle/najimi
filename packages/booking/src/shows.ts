import { env } from "@najimi/env/server"
import { geohashOf } from "@najimi/geo"

/*
 * Shows near a plan (W18): Ticketmaster Discovery v2 events around a point and a time, linked out
 * to buy (Ticketmaster sells the ticket). Concerts first; anything else on that night after.
 */

export type Show = {
  id: string
  name: string
  url: string
  image: string | null
  venue: string | null
  lat: number | null
  lon: number | null
  /** ISO, when the event starts. */
  startsAt: string | null
  localDate: string | null
  localTime: string | null
  genre: string | null
  price: { min: number; max: number; currency: string } | null
}

export const showsOn = () => Boolean(env.TICKETMASTER_API_KEY)

type TmEvent = {
  id: string
  name: string
  url: string
  images?: { url: string; width?: number; ratio?: string }[]
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string } }
  priceRanges?: { min?: number; max?: number; currency?: string }[]
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[]
  _embedded?: {
    venues?: { name?: string; location?: { latitude?: string; longitude?: string } }[]
  }
}

export async function showsNear(input: {
  lat: number
  lon: number
  /** From and to, ISO (UTC). */
  from: string
  to: string
  radiusKm?: number
  keyword?: string
  size?: number
}): Promise<Show[]> {
  if (!env.TICKETMASTER_API_KEY) return []
  const params = new URLSearchParams({
    apikey: env.TICKETMASTER_API_KEY,
    // `latlong` is deprecated; Discovery takes the point as a geohash.
    geoPoint: geohashOf(input.lat, input.lon, 9),
    radius: String(input.radiusKm ?? 25),
    unit: "km",
    startDateTime: input.from.replace(/\.\d{3}Z$/, "Z"),
    endDateTime: input.to.replace(/\.\d{3}Z$/, "Z"),
    size: String(input.size ?? 10),
    sort: "date,asc",
  })
  if (input.keyword) params.set("keyword", input.keyword)
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!res?.ok) return []
  const body = (await res.json()) as { _embedded?: { events?: TmEvent[] } }
  return (body._embedded?.events ?? []).map((e) => {
    const venue = e._embedded?.venues?.[0]
    const wide = [...(e.images ?? [])]
      .filter((i) => i.ratio === "16_9")
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
    const price = e.priceRanges?.[0]
    return {
      id: e.id,
      name: e.name,
      url: e.url,
      image: wide?.url ?? e.images?.[0]?.url ?? null,
      venue: venue?.name ?? null,
      lat: venue?.location?.latitude ? Number(venue.location.latitude) : null,
      lon: venue?.location?.longitude ? Number(venue.location.longitude) : null,
      startsAt: e.dates?.start?.dateTime ?? null,
      localDate: e.dates?.start?.localDate ?? null,
      localTime: e.dates?.start?.localTime ?? null,
      genre: e.classifications?.[0]?.genre?.name ?? e.classifications?.[0]?.segment?.name ?? null,
      price:
        price?.min != null && price.currency
          ? { min: price.min, max: price.max ?? price.min, currency: price.currency }
          : null,
    }
  })
}

/** One date on an artist's tour: where and when, and where to buy (Ticketmaster). */
export type TourDate = {
  id: string
  url: string
  venue: string | null
  city: string | null
  country: string | null
  localDate: string | null
  localTime: string | null
}

type TmTourEvent = TmEvent & {
  _embedded?: TmEvent["_embedded"] & {
    venues?: { name?: string; city?: { name?: string }; country?: { countryCode?: string } }[]
    attractions?: { name?: string }[]
  }
}

/**
 * An artist's next concerts (the entity sheet's "On tour"): in the viewer's country first, else
 * anywhere. Ticketmaster's keyword search is loose, so only events billing the artist by name
 * count.
 */
export async function tourDates(artist: string, country: string): Promise<TourDate[]> {
  if (!env.TICKETMASTER_API_KEY) return []
  const name = artist.trim().toLowerCase()
  const find = async (countryCode?: string) => {
    const params = new URLSearchParams({
      apikey: env.TICKETMASTER_API_KEY ?? "",
      keyword: artist,
      classificationName: "music",
      size: "20",
      sort: "date,asc",
    })
    if (countryCode) params.set("countryCode", countryCode)
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    if (!res?.ok) return []
    const body = (await res.json()) as { _embedded?: { events?: TmTourEvent[] } }
    return (body._embedded?.events ?? [])
      .filter((e) => e._embedded?.attractions?.some((a) => a.name?.trim().toLowerCase() === name))
      .map((e) => {
        const venue = e._embedded?.venues?.[0]
        return {
          id: e.id,
          url: e.url,
          venue: venue?.name ?? null,
          city: venue?.city?.name ?? null,
          country: venue?.country?.countryCode ?? null,
          localDate: e.dates?.start?.localDate ?? null,
          localTime: e.dates?.start?.localTime ?? null,
        }
      })
  }
  const near = /^[A-Z]{2}$/.test(country) ? await find(country) : []
  return (near.length ? near : await find()).slice(0, 4)
}
