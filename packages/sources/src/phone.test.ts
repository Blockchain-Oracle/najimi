import assert from "node:assert/strict"
import { test } from "node:test"
import { normalisePhone, phoneFrom } from "./phone"

test("schema.org telephone wins over tel: links", () => {
  const html = `<a href="tel:+2341111111">x</a><script type="application/ld+json">{"@type":"Restaurant","telephone":"+234 803 123 4567"}</script>`
  assert.equal(phoneFrom(html), "+234 803 123 4567")
  assert.equal(phoneFrom(`<a href="tel:0803%20123%204567">Call</a>`), "0803 123 4567")
})

test("numbers come out international", () => {
  assert.equal(normalisePhone("+234 803 123 4567"), "+2348031234567")
  assert.equal(normalisePhone("0803 123 4567", "234"), "+2348031234567")
  assert.equal(normalisePhone("00 351 21 123 4567"), "+351211234567")
  assert.equal(normalisePhone("0803 123 4567"), null)
})
