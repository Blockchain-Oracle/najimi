/** A place a ride or a route goes through. */
export type Spot = { lat: number; lon: number; name: string; address?: string | null }

const uberSpot = (s: Spot) =>
  JSON.stringify({
    latitude: s.lat,
    longitude: s.lon,
    addressLine1: s.name,
    addressLine2: s.address ?? "",
  })

/**
 * Uber's universal link (developer.uber.com, ride request deep links): pickup (else where you
 * are) and one or more drops, in order. Opens the Uber app, or Uber on the web.
 */
export function uberLink(drops: Spot[], pickup?: Spot) {
  const url = new URL("https://m.uber.com/looking")
  if (pickup) url.searchParams.set("pickup", uberSpot(pickup))
  drops.forEach((d, i) => {
    url.searchParams.set(`drop[${i}]`, uberSpot(d))
  })
  return url.toString()
}

/**
 * The whole night in Google Maps, from where you are through every stop (Maps URLs; mobile web
 * allows 3 waypoints, so longer plans keep the first three before the last).
 */
export function mapsRoute(stops: Spot[], mode: "driving" | "walking" = "driving") {
  const last = stops.at(-1)
  if (!last) return null
  const url = new URL("https://www.google.com/maps/dir/")
  url.searchParams.set("api", "1")
  url.searchParams.set("destination", `${last.lat},${last.lon}`)
  const through = stops.slice(0, -1).slice(0, 3)
  if (through.length)
    url.searchParams.set("waypoints", through.map((s) => `${s.lat},${s.lon}`).join("|"))
  url.searchParams.set("travelmode", mode)
  return url.toString()
}
