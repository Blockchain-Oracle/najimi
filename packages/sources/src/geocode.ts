import { MEDIA_LINKS } from "@najimi/config"
import { cached } from "./cache"

/*
 * Places on the map by name (OpenStreetMap's Nominatim): a neighbourhood, a street, an address.
 * Nominatim knows city neighbourhoods ("Yaba, Lagos") that commercial geocoders read as street
 * names. Its policy asks for one request a second at most and a real User-Agent; every answer is
 * kept a month, so each place is asked once.
 */

export type Geocoded = {
  name: string
  lat: number
  lon: number
  /** neighbourhood / street / address answers are precise; region answers (a county) are broad. */
  precise: boolean
}

const PRECISE = new Set([
  "suburb",
  "neighbourhood",
  "quarter",
  "city_district",
  "borough",
  "town",
  "village",
  "city",
  "road",
  "house",
  "building",
  "amenity",
  "shop",
  "leisure",
  "tourism",
  "place",
])

let last = 0
/** One request a second across this process (Nominatim's limit). */
async function turn() {
  const wait = last + 1100 - Date.now()
  last = Math.max(Date.now(), last + 1100)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

export async function geocode(query: string): Promise<Geocoded | null> {
  const q = query.trim().replace(/\s+/g, " ")
  if (q.length < 2) return null
  return cached<Geocoded | null>("geocode", q.toLowerCase(), 30, async () => {
    await turn()
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", q)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("limit", "1")
    const res = await fetch(url, {
      headers: { "user-agent": MEDIA_LINKS.userAgent, "accept-language": "en" },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null)
    if (!res?.ok) return null
    const [hit] = (await res.json().catch(() => [])) as {
      lat: string
      lon: string
      name?: string
      display_name?: string
      addresstype?: string
    }[]
    if (!hit) return null
    return {
      name: hit.name || hit.display_name?.split(",")[0] || q,
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      precise: PRECISE.has(hit.addresstype ?? ""),
    }
  })
}
