import assert from "node:assert/strict"
import { test } from "node:test"
import { cacheKey, normalizeParams, stableJson } from "./client"

test("params: arrays join with commas, undefined drops, keys sort", () => {
  assert.deepEqual(
    normalizeParams({
      take: 5,
      "filter.type": "urn:entity:artist",
      ids: ["a", "b"],
      skip: undefined,
    }),
    { "filter.type": "urn:entity:artist", ids: "a,b", take: "5" },
  )
})

test("cache key ignores parameter order", () => {
  const a = normalizeParams({ query: "x", take: 5 })
  const b = normalizeParams({ take: 5, query: "x" })
  assert.equal(cacheKey("/search", a), cacheKey("/search", b))
  assert.notEqual(cacheKey("/search", a), cacheKey("/entities", a))
})

test("POST bodies key by content, not key order, and never collide with GET", () => {
  const params = normalizeParams({ "filter.type": "urn:entity:book" })
  const a = { "signal.interests.entities": [{ id: "x", weight: 2 }], take: 6 }
  const b = { take: 6, "signal.interests.entities": [{ weight: 2, id: "x" }] }
  assert.equal(cacheKey("/v2/insights", params, a), cacheKey("/v2/insights", params, b))
  assert.notEqual(cacheKey("/v2/insights", params, a), cacheKey("/v2/insights", params))
  assert.equal(stableJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}')
})
