import assert from "node:assert/strict"
import { test } from "node:test"
import { cellRing, distanceKm, geohashBounds } from "./index"

test("a geohash decodes to its box (Victoria Island, Lagos)", () => {
  const [w, s, e, n] = geohashBounds("s14ktf")
  assert.ok(w < 3.43 && e > 3.42, `lon ${w}..${e}`)
  assert.ok(s < 6.43 && n > 6.42, `lat ${s}..${n}`)
  assert.ok(e - w < 0.012 && n - s < 0.006)
})

test("a cell ring is closed and inside its box", () => {
  const ring = cellRing("s14ktf")
  assert.equal(ring.length, 5)
  assert.deepEqual(ring[0], ring[4])
  const [w, s, e, n] = geohashBounds("s14ktf")
  for (const [x, y] of ring) assert.ok(x > w && x < e && y > s && y < n)
})

test("Lagos to Lisbon is about 4,000 km", () => {
  const km = distanceKm({ lat: 6.45, lon: 3.39 }, { lat: 38.72, lon: -9.14 })
  assert.ok(km > 3800 && km < 4100, String(km))
})
