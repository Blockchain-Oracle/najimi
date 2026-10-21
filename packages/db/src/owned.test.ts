import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { and, eq, inArray } from "drizzle-orm"
import { db, pg } from "./index"
import { reownUserData } from "./owned"
import { chats, people, usageDays, user, userPrefs } from "./schema"

// Runs against the local database (pnpm services:up); every row it makes is deleted at the end.

const made: string[] = []
async function makeUser(label: string) {
  const id = `test-${label}-${randomUUID()}`
  made.push(id)
  await db.insert(user).values({ id, name: label, email: `${id}@test.invalid` })
  return id
}

after(async () => {
  await db.delete(usageDays).where(inArray(usageDays.userId, made))
  await db.delete(user).where(inArray(user.id, made))
  await pg.end()
})

test("guest → new account: everything moves, nothing is left behind", async () => {
  const guest = await makeUser("guest")
  const member = await makeUser("member")
  const [me] = await db
    .insert(people)
    .values({ ownerId: guest, isSelf: true, name: "Ada" })
    .returning()
  await db.insert(chats).values({ ownerId: guest, personId: me?.id, locale: "fr" })
  await db.insert(userPrefs).values({ userId: guest, locale: "fr", mode: "auto" })
  const today = new Date().toISOString().slice(0, 10)
  await db.insert(usageDays).values({ userId: guest, day: today, turns: 3, images: 1 })

  await reownUserData(db, guest, member)

  const moved = await db.select().from(people).where(eq(people.ownerId, member))
  assert.equal(moved.length, 1)
  assert.equal(moved[0]?.isSelf, true)
  assert.equal((await db.select().from(chats).where(eq(chats.ownerId, member))).length, 1)
  const [prefs] = await db.select().from(userPrefs).where(eq(userPrefs.userId, member))
  assert.equal(prefs?.locale, "fr")
  const [usage] = await db
    .select()
    .from(usageDays)
    .where(and(eq(usageDays.userId, member), eq(usageDays.day, today)))
  assert.equal(usage?.turns, 3)
  assert.equal((await db.select().from(people).where(eq(people.ownerId, guest))).length, 0)
})

test("guest → existing account: its own me and prefs win, usage adds up, twice is safe", async () => {
  const guest = await makeUser("guest")
  const member = await makeUser("member")
  await db.insert(people).values({ ownerId: member, isSelf: true, name: "Ada" })
  await db.insert(people).values({ ownerId: guest, isSelf: true, name: "Me" })
  await db.insert(userPrefs).values({ userId: member, locale: "en", mode: "ask" })
  await db.insert(userPrefs).values({ userId: guest, locale: "ar", mode: "auto" })
  const today = new Date().toISOString().slice(0, 10)
  await db.insert(usageDays).values({ userId: member, day: today, images: 2 })
  await db.insert(usageDays).values({ userId: guest, day: today, images: 3, videos: 1 })

  await reownUserData(db, guest, member)
  await reownUserData(db, guest, member)

  const all = await db.select().from(people).where(eq(people.ownerId, member))
  assert.equal(all.length, 2)
  assert.equal(all.filter((p) => p.isSelf).length, 1)
  assert.ok(all.some((p) => p.name === "Me (guest)" && !p.isSelf))
  const [prefs] = await db.select().from(userPrefs).where(eq(userPrefs.userId, member))
  assert.equal(prefs?.locale, "en")
  assert.equal((await db.select().from(userPrefs).where(eq(userPrefs.userId, guest))).length, 0)
  const [usage] = await db
    .select()
    .from(usageDays)
    .where(and(eq(usageDays.userId, member), eq(usageDays.day, today)))
  assert.equal(usage?.images, 5)
  assert.equal(usage?.videos, 1)
})
