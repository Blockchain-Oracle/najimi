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

/** What OpenStreetMap knows about a venue: its own site and social accounts, when mapped. */
export type VenueTags = {
  website: string | null
  /** As OpenStreetMap has it (often local form). Older cached entries have none. */
  phone?: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  x: string | null
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()

/** "https://instagram.com/name/" or "name" → "name". */
const handleOf = (raw: string | undefined, host: RegExp) => {
  if (!raw) return null
  const m = raw.match(new RegExp(`${host.source}/@?([A-Za-z0-9_.]{1,40})`, "i"))
  const handle = m?.[1] ?? (/^@?[A-Za-z0-9_.]{1,40}$/.test(raw) ? raw.replace(/^@/, "") : null)
  return handle && !["p", "reel", "profile.php", "pages"].includes(handle) ? handle : null
}

/**
 * A venue found on OpenStreetMap by its name within a few hundred metres of where Qloo puts it
 * (so a same-named place in another city never matches), with its website and social tags.
 * Kept a month; places OSM doesn't have are remembered too.
 */
export async function venueTags(name: string, lat: number, lon: number): Promise<VenueTags | null> {
  const want = fold(name)
  if (want.length < 2) return null
  const key = `${want}:${lat.toFixed(3)},${lon.toFixed(3)}`
  return cached<VenueTags | null>("osm-venue", key, 30, async () => {
    await turn()
    const d = 0.005
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", name)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("extratags", "1")
    url.searchParams.set("limit", "5")
    url.searchParams.set("viewbox", `${lon - d},${lat + d},${lon + d},${lat - d}`)
    url.searchParams.set("bounded", "1")
    const res = await fetch(url, {
      headers: { "user-agent": MEDIA_LINKS.userAgent, "accept-language": "en" },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null)
    if (!res?.ok) throw new Error("Nominatim didn't answer")
    const hits = (await res.json().catch(() => [])) as {
      name?: string
      extratags?: Record<string, string> | null
    }[]
    const hit = hits.find((h) => {
      const got = fold(h.name ?? "")
      return got.length > 1 && (got.includes(want) || want.includes(got))
    })
    const tags = hit?.extratags ?? null
    if (!tags) return null
    const tag = (...keys: string[]) => keys.map((k) => tags[k]).find(Boolean)
    const website = tag("website", "contact:website", "url") ?? null
    return {
      phone: tag("phone", "contact:phone", "contact:mobile") ?? null,
      // A Facebook page given as the website is an account, not a site.
      website: website && !/facebook\.com|instagram\.com/i.test(website) ? website : null,
      instagram: handleOf(tag("contact:instagram", "instagram"), /instagram\.com/),
      facebook: handleOf(
        tag("contact:facebook", "facebook") ??
          (website && /facebook\.com/i.test(website) ? website : undefined),
        /facebook\.com/,
      ),
      tiktok: handleOf(tag("contact:tiktok", "tiktok"), /tiktok\.com/),
      x: handleOf(tag("contact:twitter", "twitter", "contact:x"), /(?:twitter|x)\.com/),
    }
  }).catch(() => null)
}
