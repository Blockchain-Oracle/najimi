import assert from "node:assert/strict"
import { test } from "node:test"
import { boundsOf, cellPolygon, cellsToGeoJSON } from "./shapes"

test("a geohash cell becomes a closed, longitude-first ring around its centre", () => {
  const [ring] = cellPolygon("dr5wct")
  assert.ok(ring)
  assert.equal(ring.length, 5)
  assert.deepEqual(ring[0], ring[4])
  const [lon, lat] = ring[0] ?? []
  assert.ok(lon !== undefined && lon < -73 && lon > -74, "longitude first")
  assert.ok(lat !== undefined && lat > 40 && lat < 41)
})

test("features keep Qloo's numbers; bounds cover every cell", () => {
  const cells = [
    { geohash: "dr5wct", lat: 40.59, lon: -73.75, affinity: 1, popularity: 0.97 },
    { geohash: "dr5ru7", lat: 40.73, lon: -73.99, affinity: 0.4, popularity: 0.5 },
  ]
  const fc = cellsToGeoJSON(cells)
  assert.equal(fc.features.length, 2)
  assert.equal(fc.features[1]?.properties.affinity, 0.4)
  const bounds = boundsOf(cells)
  assert.ok(bounds && bounds[0][0] < -73.99 && bounds[1][1] > 40.73)
})
