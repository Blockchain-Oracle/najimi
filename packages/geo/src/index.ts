/*
 * Map maths for the Earth (W11), with no dependencies: Qloo's heatmap cells are geohashes, so a
 * cell becomes a little square polygon on the globe; distances are great-circle.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

/** A geohash's box: [west, south, east, north] in degrees. */
export function geohashBounds(hash: string): [number, number, number, number] {
  let even = true
  let lat: [number, number] = [-90, 90]
  let lon: [number, number] = [-180, 180]
  for (const ch of hash.toLowerCase()) {
    const value = BASE32.indexOf(ch)
    if (value < 0) throw new Error(`Not a geohash: ${hash}`)
    for (let bit = 4; bit >= 0; bit--) {
      const on = (value >> bit) & 1
      const range = even ? lon : lat
      const mid = (range[0] + range[1]) / 2
      if (even) lon = on ? [mid, lon[1]] : [lon[0], mid]
      else lat = on ? [mid, lat[1]] : [lat[0], mid]
      even = !even
    }
  }
  return [lon[0], lat[0], lon[1], lat[1]]
}

/** A geohash cell as a closed GeoJSON ring, shrunk a touch so neighbouring columns read apart. */
export function cellRing(hash: string, inset = 0.08): [number, number][] {
  const [w, s, e, n] = geohashBounds(hash)
  const dx = (e - w) * inset
  const dy = (n - s) * inset
  return [
    [w + dx, s + dy],
    [e - dx, s + dy],
    [e - dx, n - dy],
    [w + dx, n - dy],
    [w + dx, s + dy],
  ]
}

/** Kilometres between two points on Earth. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** The middle of a set of points (for framing a city's cells). */
export function centreOf(points: { lat: number; lon: number }[]) {
  if (!points.length) return null
  const lat = points.reduce((n, p) => n + p.lat, 0) / points.length
  const lon = points.reduce((n, p) => n + p.lon, 0) / points.length
  return { lat, lon }
}
