import { SITE } from "@najimi/config"
import ngeohash from "ngeohash"
import type { HeatCell } from "./shapes"

export * from "./shapes"

/*
 * Places on Earth for the product: forward geocoding (an address → a point) and naming areas (a
 * cluster of Qloo heatmap cells → its neighbourhood), both through OpenStreetMap's Nominatim under
 * its usage policy: one shared gate (≤ 1 request a second), an identifying agent, results cached.
 */

const MIN_GAP_MS = 1100
let last = 0
const cache = new Map<string, unknown>()

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(path, SITE.geocoderUrl)
  url.search = new URLSearchParams({ format: "jsonv2", ...params }).toString()
  const key = url.toString()
  if (cache.has(key)) return cache.get(key) as T | null
  const wait = last + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  last = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": SITE.geocoderAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    const body = response.ok ? ((await response.json()) as T) : null
    cache.set(key, body)
    return body
  } catch {
    return null
  }
}

export async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const hits = await nominatim<{ lat: string; lon: string }[]>("/search", { q: query, limit: "1" })
  const hit = hits?.[0]
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null
}

type Reverse = {
  name?: string
  address?: Record<string, string>
}

/** A point's neighbourhood name (suburb level), falling back up to the city. */
export async function placeName(lat: number, lon: number): Promise<string | null> {
  const hit = await nominatim<Reverse>("/reverse", {
    lat: String(lat),
    lon: String(lon),
    zoom: "14",
  })
  const a = hit?.address ?? {}
  return (
    a.neighbourhood ??
    a.suburb ??
    a.quarter ??
    a.city_district ??
    a.borough ??
    a.town ??
    a.city ??
    hit?.name ??
    null
  )
}

export type Area = {
  /** The neighbourhood's name, from OpenStreetMap (R5: every location feature uses these). */
  name: string
  geohash: string
  lat: number
  lon: number
  /** Mean Qloo affinity and popularity of its cells. */
  affinity: number
  popularity: number
  cells: string[]
}

const AREA_PREFIX = 5
const AREA_COUNT = 6

/**
 * The hottest areas: cells grouped by their 5-character geohash (about 5 km × 5 km), ranked by
 * mean affinity, the top ones named. Areas that turn out to share a name are merged.
 */
export async function namedAreas(cells: HeatCell[], count = AREA_COUNT): Promise<Area[]> {
  const groups = new Map<string, HeatCell[]>()
  for (const cell of cells) {
    const key = cell.geohash.slice(0, AREA_PREFIX)
    groups.set(key, [...(groups.get(key) ?? []), cell])
  }
  const ranked = [...groups.entries()]
    .map(([geohash, group]) => ({
      geohash,
      cells: group,
      affinity: group.reduce((s, c) => s + c.affinity, 0) / group.length,
      popularity: group.reduce((s, c) => s + c.popularity, 0) / group.length,
    }))
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, count * 2)

  const areas = new Map<string, Area>()
  for (const group of ranked) {
    if (areas.size >= count) break
    const best = group.cells.reduce((a, b) => (b.affinity > a.affinity ? b : a))
    const { latitude, longitude } = ngeohash.decode(group.geohash)
    const name =
      (await placeName(best.lat, best.lon)) ??
      `Near ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
    const existing = areas.get(name)
    if (existing) existing.cells.push(...group.cells.map((c) => c.geohash))
    else
      areas.set(name, {
        name,
        geohash: group.geohash,
        lat: best.lat,
        lon: best.lon,
        affinity: group.affinity,
        popularity: group.popularity,
        cells: group.cells.map((c) => c.geohash),
      })
  }
  return [...areas.values()]
}
