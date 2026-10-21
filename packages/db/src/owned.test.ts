import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { and, eq, inArray } from "drizzle-orm"
import { db, pg } from "./index"
import { deleteUserData, idleGuests, reownUserData } from "./owned"
import { chats, creations, people, session, uploads, usageDays, user, userPrefs } from "./schema"

// Runs against the local database (pnpm services:up); every row it makes is deleted at the end.

const made: string[] = []
async function makeUser(label: string, extra: Partial<typeof user.$inferInsert> = {}) {
  const id = `test-${label}-${randomUUID()}`
  made.push(id)
  await db.insert(user).values({ id, name: label, email: `${id}@test.invalid`, ...extra })
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

test("delete all my data: every row goes, and every key of theirs comes back (never a sample's)", async () => {
  const id = await makeUser("leaving")
  const [me] = await db
    .insert(people)
    .values({ ownerId: id, isSelf: true, name: "Ada" })
    .returning()
  const [chat] = await db
    .insert(chats)
    .values({ ownerId: id, personId: me?.id, locale: "en" })
    .returning()
  const photo = `test/${randomUUID()}.jpg`
  const sample = `test/${randomUUID()}-sample.jpg`
  await db.insert(uploads).values([
    {
      ownerId: id,
      s3Key: photo,
      mime: "image/jpeg",
      width: 1,
      height: 1,
      bytes: 1,
      sha256: randomUUID(),
    },
    {
      ownerId: id,
      s3Key: sample,
      mime: "image/jpeg",
      width: 1,
      height: 1,
      bytes: 1,
      sha256: randomUUID(),
      sample: true,
    },
  ])
  await db.insert(creations).values({
    ownerId: id,
    chatId: chat?.id,
    kind: "image",
    purpose: "restyle",
    prompt: "test",
    status: "ready",
    s3Key: "test/c.png",
    displayKey: "test/c-display.webp",
    thumbKey: "test/c-thumb.webp",
  })
  const today = new Date().toISOString().slice(0, 10)
  await db.insert(usageDays).values({ userId: id, day: today, turns: 2 })

  const keys = await deleteUserData(db, id)

  assert.deepEqual(
    [...keys].sort(),
    [photo, "test/c.png", "test/c-display.webp", "test/c-thumb.webp"].sort(),
  )
  for (const [table, column] of [
    [people, people.ownerId],
    [chats, chats.ownerId],
    [uploads, uploads.ownerId],
    [creations, creations.ownerId],
    [usageDays, usageDays.userId],
    [user, user.id],
  ] as const) {
    const left = await db.select().from(table).where(eq(column, id))
    assert.equal(left.length, 0)
  }
})

test("idle guests: only guests nobody has used lately", async () => {
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
  const idle = await makeUser("idle-guest", { isAnonymous: true, createdAt: old })
  const back = await makeUser("returning-guest", { isAnonymous: true, createdAt: old })
  const member = await makeUser("old-member", { createdAt: old })
  await db.insert(session).values({
    id: randomUUID(),
    userId: back,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 86_400_000),
    updatedAt: new Date(),
  })

  const found = await idleGuests(db, 30, 10_000)

  assert.ok(found.includes(idle))
  assert.ok(!found.includes(back))
  assert.ok(!found.includes(member))
})
