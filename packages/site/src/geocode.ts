import { SITE } from "@najimi/config"

/*
 * Address → coordinates through OpenStreetMap's Nominatim, under its usage policy: an identifying
 * user agent, at most one request a second, and results cached. Used only when the site's own
 * JSON-LD has no coordinates and Qloo hasn't matched the place yet.
 */

const MIN_GAP_MS = 1100
let last = 0
const cache = new Map<string, { lat: number; lon: number } | null>()

export async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = query.trim().toLowerCase()
  if (cache.has(key)) return cache.get(key) ?? null
  const wait = last + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  last = Date.now()
  const url = new URL(SITE.geocoderUrl)
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" }).toString()
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": SITE.geocoderAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    const [hit] = (await response.json()) as { lat: string; lon: string }[]
    const point = hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null
    cache.set(key, point)
    return point
  } catch {
    return null
  }
}
