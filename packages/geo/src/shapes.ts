import ngeohash from "ngeohash"

/*
 * Map shapes from Qloo heatmap cells (browser-safe: no network). Each cell is drawn as its exact
 * geohash rectangle, so the map shows Qloo's own cells, not a blur (plan §6: MapLibre fill layer).
 */

export type HeatCell = {
  geohash: string
  lat: number
  lon: number
  affinity: number
  popularity: number
}

export type CellFeature = {
  type: "Feature"
  id: number
  properties: { geohash: string; affinity: number; popularity: number }
  geometry: { type: "Polygon"; coordinates: number[][][] }
}

/** A geohash cell as a GeoJSON ring (GeoJSON is longitude first). */
export function cellPolygon(geohash: string): number[][][] {
  const [minLat, minLon, maxLat, maxLon] = ngeohash.decode_bbox(geohash)
  return [
    [
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ],
  ]
}

export function cellsToGeoJSON(cells: HeatCell[]): {
  type: "FeatureCollection"
  features: CellFeature[]
} {
  return {
    type: "FeatureCollection",
    features: cells.map((cell, id) => ({
      type: "Feature",
      id,
      properties: { geohash: cell.geohash, affinity: cell.affinity, popularity: cell.popularity },
      geometry: { type: "Polygon", coordinates: cellPolygon(cell.geohash) },
    })),
  }
}

/** The bounds around a set of cells, padded, as [[west, south], [east, north]]. */
export function boundsOf(cells: HeatCell[]): [[number, number], [number, number]] | null {
  if (!cells.length) return null
  let [w, s, e, n] = [180, 90, -180, -90]
  for (const cell of cells) {
    const [minLat, minLon, maxLat, maxLon] = ngeohash.decode_bbox(cell.geohash)
    w = Math.min(w, minLon)
    s = Math.min(s, minLat)
    e = Math.max(e, maxLon)
    n = Math.max(n, maxLat)
  }
  return [
    [w, s],
    [e, n],
  ]
}
