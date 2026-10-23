import { and, eq, lt, sql } from "drizzle-orm"
import type { Db } from "./index"
import {
  blocks,
  bookings,
  businesses,
  chatMembers,
  chats,
  connectorSessions,
  creations,
  feedScores,
  follows,
  gameAnswers,
  gameRounds,
  llmCalls,
  mediaJobs,
  messages,
  notifications,
  people,
  plans,
  polls,
  pollVotes,
  pushSubscriptions,
  qlooCalls,
  reports,
  runs,
  session,
  shares,
  socialActions,
  stories,
  storyViews,
  tuneUps,
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

    for (const table of [
      people,
      chats,
      uploads,
      mediaJobs,
      creations,
      shares,
      runs,
      plans,
      bookings,
      stories,
    ]) {
      await tx.update(table).set({ ownerId: toUserId }).where(eq(table.ownerId, fromUserId))
    }
    await tx.update(qlooCalls).set({ userId: toUserId }).where(eq(qlooCalls.userId, fromUserId))
    // Rooms they're in, what they said, who they follow and who follows them, their news. A row
    // the account already has (the same room, the same follow) stays once.
    await tx.execute(sql`
      insert into ${chatMembers} (chat_id, user_id, role, last_read_at, pinned_at, joined_at)
      select chat_id, ${toUserId}, role, last_read_at, pinned_at, joined_at from ${chatMembers}
      where user_id = ${fromUserId}
      on conflict do nothing`)
    await tx.delete(chatMembers).where(eq(chatMembers.userId, fromUserId))
    await tx.update(messages).set({ authorId: toUserId }).where(eq(messages.authorId, fromUserId))
    // Polls they started and how they voted (a poll both voted in keeps the account's vote).
    await tx.update(polls).set({ createdBy: toUserId }).where(eq(polls.createdBy, fromUserId))
    await tx.execute(sql`
      insert into ${pollVotes} (poll_id, user_id, option_id, at)
      select poll_id, ${toUserId}, option_id, at from ${pollVotes}
      where user_id = ${fromUserId}
      on conflict do nothing`)
    await tx.delete(pollVotes).where(eq(pollVotes.userId, fromUserId))
    await tx.execute(sql`
      insert into ${storyViews} (story_id, viewer_id, reaction, at)
      select story_id, ${toUserId}, reaction, at from ${storyViews}
      where viewer_id = ${fromUserId}
      on conflict do nothing`)
    await tx.delete(storyViews).where(eq(storyViews.viewerId, fromUserId))
    await tx.execute(sql`
      insert into ${follows} (follower_id, followee_id, created_at)
      select ${toUserId}, followee_id, created_at from ${follows}
      where follower_id = ${fromUserId} and followee_id <> ${toUserId}
      on conflict do nothing`)
    await tx.execute(sql`
      insert into ${follows} (follower_id, followee_id, created_at)
      select follower_id, ${toUserId}, created_at from ${follows}
      where followee_id = ${fromUserId} and follower_id <> ${toUserId}
      on conflict do nothing`)
    await tx.delete(follows).where(eq(follows.followerId, fromUserId))
    await tx.delete(follows).where(eq(follows.followeeId, fromUserId))
    await tx
      .update(notifications)
      .set({ userId: toUserId })
      .where(eq(notifications.userId, fromUserId))
    await tx
      .update(notifications)
      .set({ actorId: toUserId })
      .where(eq(notifications.actorId, fromUserId))
    await tx.update(llmCalls).set({ userId: toUserId }).where(eq(llmCalls.userId, fromUserId))
    await tx.update(feedScores).set({ userId: toUserId }).where(eq(feedScores.userId, fromUserId))
    // Today's tune-up belongs to the account once it signs in (its own list wins a clash).
    await tx.execute(sql`
      update ${tuneUps} t set user_id = ${toUserId}
      where t.user_id = ${fromUserId}
        and not exists (select 1 from ${tuneUps} u where u.user_id = ${toUserId} and u.day = t.day)`)
    await tx.delete(tuneUps).where(eq(tuneUps.userId, fromUserId))
    await tx.update(businesses).set({ ownerId: toUserId }).where(eq(businesses.ownerId, fromUserId))
    // Their phones' push, who they blocked (a clash keeps the account's own), what they reported.
    await tx
      .update(pushSubscriptions)
      .set({ userId: toUserId })
      .where(eq(pushSubscriptions.userId, fromUserId))
    await tx.execute(sql`
      update ${blocks} b set blocker_id = ${toUserId}
      where b.blocker_id = ${fromUserId}
        and not exists (select 1 from ${blocks} c where c.blocker_id = ${toUserId}
          and c.blocked_id = b.blocked_id)`)
    await tx.delete(blocks).where(eq(blocks.blockerId, fromUserId))
    // Blocks against them and reports about them follow the person too.
    await tx.execute(sql`
      update ${blocks} b set blocked_id = ${toUserId}
      where b.blocked_id = ${fromUserId}
        and not exists (select 1 from ${blocks} c where c.blocked_id = ${toUserId}
          and c.blocker_id = b.blocker_id)`)
    await tx.delete(blocks).where(eq(blocks.blockedId, fromUserId))
    await tx.update(reports).set({ reporterId: toUserId }).where(eq(reports.reporterId, fromUserId))
    await tx.update(reports).set({ targetId: toUserId }).where(eq(reports.targetId, fromUserId))
    // Connected accounts (the account's own connection wins a clash) and what was done with them.
    await tx.execute(sql`
      update ${connectorSessions} c set user_id = ${toUserId}
      where c.user_id = ${fromUserId}
        and not exists (select 1 from ${connectorSessions} d where d.user_id = ${toUserId}
          and d.platform = c.platform and d.account_id = c.account_id)`)
    await tx.delete(connectorSessions).where(eq(connectorSessions.userId, fromUserId))
    await tx
      .update(socialActions)
      .set({ userId: toUserId })
      .where(eq(socialActions.userId, fromUserId))
    // Games: rounds they dealt or that are about them, and their goes (a round both accounts
    // played keeps the account's own go).
    await tx
      .update(gameRounds)
      .set({ createdBy: toUserId })
      .where(eq(gameRounds.createdBy, fromUserId))
    await tx
      .update(gameRounds)
      .set({ subjectId: toUserId })
      .where(eq(gameRounds.subjectId, fromUserId))
    await tx.execute(sql`
      update ${gameAnswers} a set player_id = ${toUserId}
      where a.player_id = ${fromUserId}
        and not exists (
          select 1 from ${gameAnswers} b where b.round_id = a.round_id and b.player_id = ${toUserId}
        )`)
    await tx.delete(gameAnswers).where(eq(gameAnswers.playerId, fromUserId))

    // Usage: summed per day, so signing in never resets the day's allowance.
    await tx.execute(sql`
      insert into ${usageDays} (user_id, day, turns, images, videos, calls, holds)
      select ${toUserId}, day, turns, images, videos, calls, holds
      from ${usageDays} where user_id = ${fromUserId}
      on conflict (user_id, day) do update set
        turns = ${usageDays}.turns + excluded.turns,
        images = ${usageDays}.images + excluded.images,
        videos = ${usageDays}.videos + excluded.videos,
        calls = ${usageDays}.calls + excluded.calls,
        holds = ${usageDays}.holds + excluded.holds`)
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
