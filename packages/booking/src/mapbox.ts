import type { PlanRoute } from "@najimi/db/schema"
import { env } from "@najimi/env/server"

/*
 * The way between a plan's stops (Mapbox Directions v5): one request for the whole route, its
 * line for the map and each leg's minutes. Walking for a night in one area, driving across a city.
 */

const BASE = "https://api.mapbox.com/directions/v5/mapbox"
/** Mapbox takes up to 25 points in one route. */
const MAX_POINTS = 25

export const routesOn = () => Boolean(env.MAPBOX_TOKEN)

export async function routeThrough(
  points: { lat: number; lon: number }[],
  profile: PlanRoute["profile"],
): Promise<PlanRoute | null> {
  if (!env.MAPBOX_TOKEN || points.length < 2) return null
  const coords = points
    .slice(0, MAX_POINTS)
    .map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`)
    .join(";")
  const url = `${BASE}/${profile}/${coords}?geometries=geojson&overview=full&access_token=${env.MAPBOX_TOKEN}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!res?.ok) return null
  const body = (await res.json()) as {
    /** "Ok", or "NoRoute" / "NoSegment" (which still come back as HTTP 200). */
    code?: string
    routes?: {
      geometry?: { coordinates?: [number, number][] }
      legs?: { duration: number; distance: number }[]
    }[]
  }
  if (body.code !== "Ok") return null
  const route = body.routes?.[0]
  if (!route?.geometry?.coordinates) return null
  return {
    profile,
    line: route.geometry.coordinates,
    legs: (route.legs ?? []).map((leg, i) => ({
      from: i,
      to: i + 1,
      minutes: Math.max(1, Math.round(leg.duration / 60)),
      km: Math.round(leg.distance / 100) / 10,
    })),
  }
}
