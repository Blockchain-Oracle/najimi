import assert from "node:assert/strict"
import { test } from "node:test"
import { cacheKey, normalizeParams } from "./client"
import { hostOf, nameSimilarity, sameAddress } from "./resolve"

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

test("matching evidence", () => {
  assert.equal(hostOf("https://www.Bar-Brutal.com/menu"), "bar-brutal.com")
  assert.equal(hostOf("bar-brutal.com"), "bar-brutal.com")
  assert.ok(nameSimilarity("Café Lua", "Cafe Lua São Paulo") >= 0.5)
  assert.ok(sameAddress("Rua Augusta 1500, São Paulo", "1500 Rua Augusta - Consolação"))
  assert.ok(!sameAddress("Rua Augusta 1500", "Rua Augusta 1501"))
})
