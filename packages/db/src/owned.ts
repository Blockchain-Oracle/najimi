import { and, eq, sql } from "drizzle-orm"
import type { Db } from "./index"
import {
  chats,
  creations,
  llmCalls,
  mediaJobs,
  people,
  qlooCalls,
  runs,
  shares,
  uploads,
  usageDays,
  userPrefs,
  workflowFavourites,
  workflows,
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
    await tx.update(workflows).set({ ownerId: toUserId }).where(eq(workflows.ownerId, fromUserId))
    await tx.update(qlooCalls).set({ userId: toUserId }).where(eq(qlooCalls.userId, fromUserId))
    await tx.update(llmCalls).set({ userId: toUserId }).where(eq(llmCalls.userId, fromUserId))

    // Favourites: union, no duplicates.
    await tx.execute(sql`
      insert into ${workflowFavourites} (user_id, workflow_id, created_at)
      select ${toUserId}, workflow_id, created_at from ${workflowFavourites} where user_id = ${fromUserId}
      on conflict do nothing`)
    await tx.delete(workflowFavourites).where(eq(workflowFavourites.userId, fromUserId))

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
