import "server-only"
import { publishMessage, toUI } from "@najimi/agent/server"
import { STORIES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { StoryKind, StorySong, StoryThing } from "@najimi/db/schema"
import { mediaPath } from "@najimi/storage"
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import { dmWith } from "@/lib/chat/store"
import { blockedWith, notify, visibleTo } from "@/lib/social"

/*
 * Stories (S18): a day-long post, seen by whoever may see that person's taste (public: everyone;
 * friends: friends; private: no one), never across a block. The tray is you and the people you
 * follow with something up; each story knows whether you've seen it; a reply or a reaction lands
 * in your DM with them, with the story it answers.
 */

export type StoryCard = {
  id: string
  kind: StoryKind
  status: "processing" | "ready" | "failed"
  caption: string | null
  createdAt: string
  media: { src: string | null; poster: string | null; video: boolean }
  song: StorySong | null
  thing: StoryThing | null
  plan: { token: string; title: string; city: string | null; image: string | null } | null
  wrapped: { token: string; slide: number } | null
  seen: boolean
  reaction: string | null
  /** Only on your own: how many have seen it. */
  views: number | null
}

export type TrayPerson = {
  userId: string
  name: string
  username: string | null
  look: string | null
  mine: boolean
  count: number
  unseen: number
  latestAt: string
}

const live = () => and(gt(schema.stories.expiresAt, new Date()), eq(schema.stories.status, "ready"))

/** For each owner, whether this viewer may see their stories. */
async function audience(viewerId: string, ownerIds: string[]): Promise<Set<string>> {
  if (!ownerIds.length) return new Set()
  const [people, followsBack, blocked] = await Promise.all([
    db
      .select({ ownerId: schema.people.ownerId, visibility: schema.people.visibility })
      .from(schema.people)
      .where(and(inArray(schema.people.ownerId, ownerIds), eq(schema.people.isSelf, true))),
    db
      .select({ followerId: schema.follows.followerId, followeeId: schema.follows.followeeId })
      .from(schema.follows)
      .where(
        sql`(${schema.follows.followerId} = ${viewerId} and ${inArray(schema.follows.followeeId, ownerIds)})
          or (${schema.follows.followeeId} = ${viewerId} and ${inArray(schema.follows.followerId, ownerIds)})`,
      ),
    blockedWith(viewerId),
  ])
  const iFollow = new Set(
    followsBack.filter((f) => f.followerId === viewerId).map((f) => f.followeeId),
  )
  const followsMe = new Set(
    followsBack.filter((f) => f.followeeId === viewerId).map((f) => f.followerId),
  )
  const ok = new Set<string>()
  for (const p of people) {
    const self = p.ownerId === viewerId
    if (!self && blocked.has(p.ownerId)) continue
    const friends = iFollow.has(p.ownerId) && followsMe.has(p.ownerId)
    if (visibleTo(p.visibility, self, friends)) ok.add(p.ownerId)
  }
  return ok
}

export async function canSeeStoriesOf(viewerId: string, ownerId: string) {
  return (await audience(viewerId, [ownerId])).has(ownerId)
}

/** You, then the people you follow who have something up (unseen first, newest first). */
export async function storiesTray(viewerId: string): Promise<TrayPerson[]> {
  const followees = await db
    .select({ id: schema.follows.followeeId })
    .from(schema.follows)
    .where(eq(schema.follows.followerId, viewerId))
  const owners = [viewerId, ...followees.map((f) => f.id)]
  const rows = await db
    .select({
      ownerId: schema.stories.ownerId,
      id: schema.stories.id,
      createdAt: schema.stories.createdAt,
      seen: sql<boolean>`exists (select 1 from ${schema.storyViews} v where v.story_id = ${schema.stories.id} and v.viewer_id = ${viewerId})`,
    })
    .from(schema.stories)
    .where(and(inArray(schema.stories.ownerId, owners), live()))
    .orderBy(asc(schema.stories.createdAt))
  const withStories = [...new Set(rows.map((r) => r.ownerId))]
  const allowed = await audience(viewerId, withStories)
  const visible = withStories.filter((id) => allowed.has(id))
  if (!visible.length) return []
  const people = await db
    .select({
      userId: schema.people.ownerId,
      name: schema.people.name,
      look: schema.people.look,
      username: schema.user.displayUsername,
    })
    .from(schema.people)
    .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
    .where(and(inArray(schema.people.ownerId, visible), eq(schema.people.isSelf, true)))
  return people
    .map((p) => {
      const mine = rows.filter((r) => r.ownerId === p.userId)
      return {
        ...p,
        mine: p.userId === viewerId,
        count: mine.length,
        unseen: mine.filter((r) => !r.seen).length,
        latestAt: (mine.at(-1)?.createdAt ?? new Date()).toISOString(),
      }
    })
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        Number(b.unseen > 0) - Number(a.unseen > 0) ||
        b.latestAt.localeCompare(a.latestAt),
    )
}

/** Someone's stories, oldest first, as their viewer plays them (null: not yours to see). */
export async function storiesOf(ownerId: string, viewerId: string): Promise<StoryCard[] | null> {
  if (!(await canSeeStoriesOf(viewerId, ownerId))) return null
  const mine = ownerId === viewerId
  const rows = await db
    .select({
      story: schema.stories,
      mime: schema.uploads.mime,
      view: schema.storyViews,
      views: sql<number>`(select count(*)::int from ${schema.storyViews} v where v.story_id = ${schema.stories.id})`,
    })
    .from(schema.stories)
    .leftJoin(schema.uploads, eq(schema.uploads.id, schema.stories.uploadId))
    .leftJoin(
      schema.storyViews,
      and(
        eq(schema.storyViews.storyId, schema.stories.id),
        eq(schema.storyViews.viewerId, viewerId),
      ),
    )
    .where(
      and(
        eq(schema.stories.ownerId, ownerId),
        gt(schema.stories.expiresAt, new Date()),
        // Your own processing (and failed) videos show to you, so you know where they are.
        mine ? undefined : eq(schema.stories.status, "ready"),
      ),
    )
    .orderBy(asc(schema.stories.createdAt))
  const tokens = rows.flatMap((r) => (r.story.planToken ? [r.story.planToken] : []))
  const plans = tokens.length
    ? await db
        .select({
          token: schema.plans.token,
          title: schema.plans.title,
          city: schema.plans.city,
          stops: schema.plans.stops,
        })
        .from(schema.plans)
        .where(and(inArray(schema.plans.token, tokens), isNull(schema.plans.closedAt)))
    : []
  return rows.map(({ story: s, mime, view, views }) => {
    const plan = plans.find((p) => p.token === s.planToken)
    return {
      id: s.id,
      kind: s.kind,
      status: s.status,
      caption: s.caption,
      createdAt: s.createdAt.toISOString(),
      media: {
        src: s.uploadId ? mediaPath("upload", s.uploadId, "original") : null,
        poster: s.posterId ? mediaPath("upload", s.posterId, "original") : null,
        video: Boolean(mime?.startsWith("video/")),
      },
      song: s.song,
      thing: s.thing,
      plan: plan
        ? {
            token: plan.token,
            title: plan.title,
            city: plan.city,
            image: plan.stops.find((st) => st.image)?.image ?? null,
          }
        : null,
      wrapped: s.wrapped,
      seen: Boolean(view),
      reaction: view?.reaction ?? null,
      views: mine ? views : null,
    }
  })
}

/** Whether an upload is shown by a story this viewer may see (the media route asks). */
export async function sharedInStory(uploadId: string, viewerId: string): Promise<boolean> {
  const [s] = await db
    .select({ ownerId: schema.stories.ownerId })
    .from(schema.stories)
    .where(
      and(
        sql`(${schema.stories.uploadId} = ${uploadId} or ${schema.stories.posterId} = ${uploadId})`,
        gt(schema.stories.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return s ? canSeeStoriesOf(viewerId, s.ownerId) : false
}

export async function activeCount(ownerId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.stories)
    .where(and(eq(schema.stories.ownerId, ownerId), gt(schema.stories.expiresAt, new Date())))
  return row?.n ?? 0
}

export const expiry = () => new Date(Date.now() + STORIES.hours * 60 * 60 * 1000)

/** A story they may see, with its owner. */
async function visibleStory(storyId: string, viewerId: string) {
  const [s] = await db
    .select()
    .from(schema.stories)
    .where(and(eq(schema.stories.id, storyId), live()))
  if (!s || !(await canSeeStoriesOf(viewerId, s.ownerId))) return null
  return s
}

/** They saw it (once; a later reaction is kept with the view). */
export async function markViewed(storyId: string, viewerId: string, reaction?: string | null) {
  const s = await visibleStory(storyId, viewerId)
  if (!s || s.ownerId === viewerId) return s
  await db
    .insert(schema.storyViews)
    .values({ storyId, viewerId, reaction: reaction ?? null })
    .onConflictDoUpdate({
      target: [schema.storyViews.storyId, schema.storyViews.viewerId],
      set: reaction ? { reaction } : { at: sql`${schema.storyViews.at}` },
    })
  return s
}

/** What a story looks like when a reply quotes it in the DM. */
const quoteOf = (s: typeof schema.stories.$inferSelect) => ({
  id: s.id,
  kind: s.kind,
  image: s.posterId
    ? mediaPath("upload", s.posterId, "thumb")
    : s.uploadId && s.kind === "photo"
      ? mediaPath("upload", s.uploadId, "original")
      : (s.thing?.image ?? s.song?.artwork ?? null),
  label: s.caption ?? s.thing?.name ?? s.song?.title ?? null,
})

/** A reply or a reaction, sent to them as a DM that quotes the story. */
export async function answerStory(
  storyId: string,
  viewerId: string,
  text: string,
  locale: string,
): Promise<{ chatId: string } | null> {
  const s = await visibleStory(storyId, viewerId)
  if (!s || s.ownerId === viewerId) return null
  const chat = await dmWith(viewerId, s.ownerId, locale)
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: `msg_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`,
      chatId: chat.id,
      role: "user",
      authorId: viewerId,
      parts: [{ type: "text", text }],
      metadata: { story: quoteOf(s) },
    })
    .returning()
  if (row) await publishMessage(chat.id, toUI(row))
  await db
    .update(schema.chats)
    .set({ lastActiveAt: new Date() })
    .where(eq(schema.chats.id, chat.id))
  await notify({
    userId: s.ownerId,
    kind: "message",
    actorId: viewerId,
    chatId: chat.id,
    data: { text: text.slice(0, 120) },
  })
  return { chatId: chat.id }
}

/** Who saw your story, newest first, with how they reacted. */
export async function viewersOf(storyId: string, ownerId: string) {
  const [s] = await db
    .select({ id: schema.stories.id })
    .from(schema.stories)
    .where(and(eq(schema.stories.id, storyId), eq(schema.stories.ownerId, ownerId)))
  if (!s) return null
  return db
    .select({
      userId: schema.storyViews.viewerId,
      reaction: schema.storyViews.reaction,
      at: schema.storyViews.at,
      name: schema.people.name,
      look: schema.people.look,
      username: schema.user.displayUsername,
    })
    .from(schema.storyViews)
    .innerJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.storyViews.viewerId), eq(schema.people.isSelf, true)),
    )
    .innerJoin(schema.user, eq(schema.user.id, schema.storyViews.viewerId))
    .where(eq(schema.storyViews.storyId, storyId))
    .orderBy(desc(schema.storyViews.at))
}

/** Takes a story down (and its files with the next sweep: it expires now). */
export async function removeStory(storyId: string, ownerId: string) {
  const [s] = await db
    .update(schema.stories)
    .set({ expiresAt: new Date(0) })
    .where(and(eq(schema.stories.id, storyId), eq(schema.stories.ownerId, ownerId)))
    .returning({ id: schema.stories.id })
  return Boolean(s)
}
