import assert from "node:assert/strict"
import { test } from "node:test"
import { icsOf } from "./ics"

test("a calendar file has one event per stop, escaped and folded", () => {
  const ics = icsOf([
    {
      uid: "a",
      title: "Drinks, then NOK by Alara; late at Hard Rock",
      start: new Date("2026-10-24T20:00:00Z"),
      end: new Date("2026-10-24T22:00:00Z"),
      where: "Victoria Island, Lagos",
      notes: "x".repeat(200),
    },
  ])
  assert.match(ics, /BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /SUMMARY:Drinks\\, then NOK by Alara\\; late at Hard Rock/)
  assert.match(ics, /DTSTART:20261024T200000Z/)
  for (const line of ics.split("\r\n")) assert.ok(line.length <= 75, line)
})
