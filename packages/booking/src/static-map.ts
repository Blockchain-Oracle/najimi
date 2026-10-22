import type { PlanRoute, PlanStop } from "@najimi/db/schema"
import { env } from "@najimi/env/server"
import { encodePolyline } from "./polyline"

/*
 * A plan's map as one picture (Mapbox Static Images): the dark style, the route in the accent
 * colour, and numbered pins for the stops. Fetched by our own route, so the page never holds the
 * token and the picture caches.
 */

/** Every nth point, so a long route still fits in a URL. */
const thin = (line: [number, number][], max: number) => {
  if (line.length <= max) return line
  const step = (line.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => line[Math.round(i * step)] as [number, number])
}

export function staticMapUrl(
  stops: PlanStop[],
  route: PlanRoute | null,
  size = { w: 640, h: 360 },
): string | null {
  if (!env.MAPBOX_TOKEN) return null
  const pins = stops
    .filter((s) => s.lat != null && s.lon != null)
    .slice(0, 9)
    .map(
      (s, i) =>
        `pin-s-${i + 1}+ff5ca8(${(s.lon as number).toFixed(5)},${(s.lat as number).toFixed(5)})`,
    )
  if (!pins.length) return null
  const path = route?.line.length
    ? [`path-4+ff5ca8-0.85(${encodeURIComponent(encodePolyline(thin(route.line, 250)))})`]
    : []
  const overlays = [...path, ...pins].join(",")
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlays}/auto/${size.w}x${size.h}@2x?padding=48&access_token=${env.MAPBOX_TOKEN}`
}
