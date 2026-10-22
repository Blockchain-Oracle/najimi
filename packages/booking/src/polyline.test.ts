import assert from "node:assert/strict"
import { test } from "node:test"
import { encodePolyline } from "./polyline"

test("encodes the reference polyline from Google's docs", () => {
  // (38.5, -120.2), (40.7, -120.95), (43.252, -126.453) → "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
  assert.equal(
    encodePolyline([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]),
    "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  )
})
