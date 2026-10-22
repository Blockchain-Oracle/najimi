import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameItem } from "@najimi/db/schema"
import { bandOf, najimiPlays, publicItems, scoreOf } from "./index"

const item = (truth: number, options?: string[]): GameItem => ({
  qlooId: `id-${truth}`,
  type: "urn:entity:movie",
  name: `Film ${truth}`,
  image: null,
  caption: null,
  truth,
  ...(options ? { options: options.map((o) => ({ id: o, label: o })) } : {}),
})

test("a player never sees the truth before answering", () => {
  const visible = publicItems([item(80), item(1, ["a", "b", "c"])])
  for (const v of visible) assert.equal("truth" in v, false)
  assert.deepEqual(
    visible[1]?.options?.map((o) => o.id),
    ["a", "b", "c"],
  )
})

test("wavelength scores closeness: exact is 100, 10 off is 80, far off floors at 0", () => {
  const items = [item(70), item(70), item(70), item(70)]
  const { perItem, score } = scoreOf("wavelength", items, [70, 80, 60, 0])
  assert.deepEqual(perItem, [100, 80, 80, 0])
  assert.equal(score, 260)
})

test("choices score only the right one, and missing answers score nothing", () => {
  const items = [item(2, ["a", "b", "c"]), item(0, ["a", "b"]), item(1, ["a", "b"])]
  const { perItem, right } = scoreOf("knowme", items, [2, 1])
  assert.deepEqual(perItem, [100, 0, 0])
  assert.equal(right, 1)
})

test("blind taste is right when your feeling matches Qloo's band", () => {
  assert.equal(bandOf(90), 2)
  assert.equal(bandOf(60), 1)
  assert.equal(bandOf(30), 0)
  const { right } = scoreOf("blind", [item(90), item(60), item(30)], [2, 2, 0])
  assert.equal(right, 2)
})

test("Najimi plays the same way every time for a round, and never perfectly on the wavelength", () => {
  const items = [item(50), item(90), item(10)]
  const a = najimiPlays("wavelength", items, "round-1")
  assert.deepEqual(a, najimiPlays("wavelength", items, "round-1"))
  a.forEach((g, i) => {
    const off = Math.abs(g - (items[i]?.truth ?? 0))
    assert.ok(off >= 4 && off <= 22, `off by ${off}`)
  })
})
