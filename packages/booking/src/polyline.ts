/* Google's encoded polyline (precision 5): the path format Mapbox Static Images takes. */

export function encodePolyline(points: [number, number][]): string {
  let out = ""
  let lastLat = 0
  let lastLon = 0
  const encode = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1
    let chunk = ""
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    return chunk + String.fromCharCode(v + 63)
  }
  for (const [lon, lat] of points) {
    const la = Math.round(lat * 1e5)
    const lo = Math.round(lon * 1e5)
    out += encode(la - lastLat) + encode(lo - lastLon)
    lastLat = la
    lastLon = lo
  }
  return out
}
