import { and, eq, lt, sql } from "drizzle-orm"
import type { Db } from "./index"
import {
  chats,
  creations,
  llmCalls,
  mediaJobs,
  people,
  qlooCalls,
  runs,
  session,
  shares,
  uploads,
  usageDays,
  user,
  userPrefs,
} from "./schema"

/**
 * A guest who signs in keeps everything they made: their rows move to the signed-in user. Better
 * Auth calls this on every sign-in, including into an account that already exists, so it:
 * - keeps the account's own preferences (the guest's are dropped when the account has some);
 * - turns the guest's "me" into "Me (guest)" when the account already has a "me";
 * - adds the guest's usage today to the account's (no free allowance by signing in);
 * - is idempotent: a second run finds nothing left to move.
 * Every owned table is listed here; a new owned table must be added.
 */
export async function reownUserData(db: Db, fromUserId: string, toUserId: string): Promise<void> {
  if (fromUserId === toUserId) return
  await db.transaction(async (tx) => {
    // The handle the guest chose moves too, unless the account already has one.
    const [from] = await tx
      .select({ username: user.username, displayUsername: user.displayUsername })
      .from(user)
      .where(eq(user.id, fromUserId))
    const [to] = await tx
      .select({ username: user.username })
      .from(user)
      .where(eq(user.id, toUserId))
    if (from?.username && !to?.username) {
      await tx
        .update(user)
        .set({ username: null, displayUsername: null })
        .where(eq(user.id, fromUserId))
      await tx
        .update(user)
        .set({ username: from.username, displayUsername: from.displayUsername })
        .where(eq(user.id, toUserId))
    }
    // Preferences: the account's win.
    const [existingPrefs] = await tx
      .select({ userId: userPrefs.userId })
      .from(userPrefs)
      .where(eq(userPrefs.userId, toUserId))
    if (existingPrefs) await tx.delete(userPrefs).where(eq(userPrefs.userId, fromUserId))
    else
      await tx.update(userPrefs).set({ userId: toUserId }).where(eq(userPrefs.userId, fromUserId))

    // One "me" per account.
    const [targetSelf] = await tx
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.ownerId, toUserId), eq(people.isSelf, true)))
    if (targetSelf) {
      await tx
        .update(people)
        .set({ isSelf: false, name: sql`${people.name} || ' (guest)'` })
        .where(and(eq(people.ownerId, fromUserId), eq(people.isSelf, true)))
    }

    for (const table of [people, chats, uploads, mediaJobs, creations, shares, runs]) {
      await tx.update(table).set({ ownerId: toUserId }).where(eq(table.ownerId, fromUserId))
    }
    await tx.update(qlooCalls).set({ userId: toUserId }).where(eq(qlooCalls.userId, fromUserId))
    await tx.update(llmCalls).set({ userId: toUserId }).where(eq(llmCalls.userId, fromUserId))

    // Usage: summed per day, so signing in never resets the day's allowance.
    await tx.execute(sql`
      insert into ${usageDays} (user_id, day, turns, images, videos)
      select ${toUserId}, day, turns, images, videos from ${usageDays} where user_id = ${fromUserId}
      on conflict (user_id, day) do update set
        turns = ${usageDays}.turns + excluded.turns,
        images = ${usageDays}.images + excluded.images,
        videos = ${usageDays}.videos + excluded.videos`)
    await tx.delete(usageDays).where(eq(usageDays.userId, fromUserId))
  })
}

/**
 * "Delete all my data" (T21), and the guest sweep: every row the person owns goes, in one
 * transaction (each owned table cascades from the user row; the usage counters have no key, so
 * they go by hand). Returns the storage keys of their photos and creations, for the caller to
 * delete once the rows are gone. Sample rooms belong to everyone and are never returned.
 */
export async function deleteUserData(db: Db, userId: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const photos = await tx
      .select({ key: uploads.s3Key })
      .from(uploads)
      .where(and(eq(uploads.ownerId, userId), eq(uploads.sample, false)))
    const made = await tx
      .select({
        s3Key: creations.s3Key,
        displayKey: creations.displayKey,
        thumbKey: creations.thumbKey,
        posterKey: creations.posterKey,
      })
      .from(creations)
      .where(eq(creations.ownerId, userId))
    await tx.delete(usageDays).where(eq(usageDays.userId, userId))
    await tx.delete(user).where(eq(user.id, userId))
    const keys = [
      ...photos.map((p) => p.key),
      ...made.flatMap((c) => [c.s3Key, c.displayKey, c.thumbKey, c.posterKey]),
    ]
    return [...new Set(keys.filter((k): k is string => Boolean(k)))]
  })
}

/**
 * Guests nobody has used for `days`: no session refreshed and no chat touched since. Sessions
 * refresh daily while in use, so a guest who comes back now and then is never swept; nor is one
 * whose creation is in the public showcase.
 */
export async function idleGuests(db: Db, days: number, limit: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const since = sql`${cutoff.toISOString()}::timestamptz`
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.isAnonymous, true),
        lt(user.createdAt, cutoff),
        sql`not exists (select 1 from ${session} where ${session.userId} = ${user.id} and ${session.updatedAt} > ${since})`,
        sql`not exists (select 1 from ${chats} where ${chats.ownerId} = ${user.id} and ${chats.lastActiveAt} > ${since})`,
        // A guest whose creation is in the public showcase stays.
        sql`not exists (select 1 from ${creations} where ${creations.ownerId} = ${user.id} and ${creations.public})`,
      ),
    )
    .limit(limit)
  return rows.map((r) => r.id)
}
