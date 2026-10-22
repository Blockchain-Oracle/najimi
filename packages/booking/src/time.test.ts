import assert from "node:assert/strict"
import { test } from "node:test"
import { safeZone, todayIn, zonedTime } from "./time"

test("9pm in Lagos is 20:00 UTC", () => {
  assert.equal(
    zonedTime("2026-10-24", "21:00", "Africa/Lagos").toISOString(),
    "2026-10-24T20:00:00.000Z",
  )
})

test("across a clock change: 10:00 in London on 25 October 2026 is 10:00 UTC (GMT again)", () => {
  assert.equal(
    zonedTime("2026-10-25", "10:00", "Europe/London").toISOString(),
    "2026-10-25T10:00:00.000Z",
  )
  assert.equal(
    zonedTime("2026-10-24", "10:00", "Europe/London").toISOString(),
    "2026-10-24T09:00:00.000Z",
  )
})

test("today in a zone, and unknown zones fall back to UTC", () => {
  assert.equal(todayIn("Asia/Tokyo", new Date("2026-10-24T20:00:00Z")), "2026-10-25")
  assert.equal(safeZone("Not/AZone"), "UTC")
})
