import "server-only"
import { GAMES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { NotificationKind } from "@najimi/db/schema"
import { lastEventId, publish, topic } from "@najimi/live"
import { compare } from "@najimi/qloo"
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm"

/*
 * People (W7): finding someone by @username or name, following (two ways is friends), what their
 * profile shows you (their visibility decides), your news, and how well two tastes match (Qloo's
 * compare: the share of taste words two people have in common).
 */

/** Everyone this person blocked, or who blocked them: neither side sees or reaches the other. */
export async function blockedWith(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ a: schema.blocks.blockerId, b: schema.blocks.blockedId })
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, userId), eq(schema.blocks.blockedId, userId)))
  return new Set(rows.map((r) => (r.a === userId ? r.b : r.a)))
}

export type PersonCard = {
  userId: string
  personId: string
  name: string
  username: string | null
  look: string | null
  aura: { c1: string; c2: string; c3: string } | null
  city: string | null
}

const cardColumns = {
  userId: schema.people.ownerId,
  personId: schema.people.id,
  name: schema.people.name,
  username: schema.user.displayUsername,
  look: schema.people.look,
  aura: schema.people.aura,
  city: schema.people.city,
  visibility: schema.people.visibility,
}

/** Who follows whom between two people. */
export async function relation(viewerId: string, otherId: string) {
  const rows = await db
    .select()
    .from(schema.follows)
    .where(
      or(
        and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followeeId, otherId)),
        and(eq(schema.follows.followerId, otherId), eq(schema.follows.followeeId, viewerId)),
      ),
    )
  const following = rows.some((r) => r.followerId === viewerId)
  const followedBy = rows.some((r) => r.followerId === otherId)
  return { following, followedBy, friends: following && followedBy }
}

/** Whether a profile shows to this viewer: public to all, friends to friends, private to no one. */
export function visibleTo(
  visibility: "public" | "friends" | "private",
  isSelf: boolean,
  friends: boolean,
) {
  return isSelf || visibility === "public" || (visibility === "friends" && friends)
}

/** People by @username (prefix) or name, newest profiles first; private profiles never show. */
export async function findPeople(q: string, viewerId: string, limit = 20): Promise<PersonCard[]> {
  const term = q.trim().replace(/^@/, "").replace(/[%_]/g, "")
  if (!term) return []
  const rows = await db
    .select(cardColumns)
    .from(schema.people)
    .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
    .where(
      and(
        eq(schema.people.isSelf, true),
        ne(schema.people.visibility, "private"),
        ne(schema.people.ownerId, viewerId),
        or(
          ilike(schema.user.username, `${term.toLowerCase()}%`),
          ilike(schema.people.name, `%${term}%`),
        ),
      ),
    )
    .orderBy(desc(schema.people.updatedAt))
    .limit(limit)
  const blocked = await blockedWith(viewerId)
  return rows.filter((r) => !blocked.has(r.userId)).map(({ visibility: _v, ...card }) => card)
}

/** Someone's own profile by username, with what the viewer may see of it. */
export async function profileByUsername(username: string, viewerId: string) {
  const [row] = await db
    .select({ person: schema.people, username: schema.user.displayUsername })
    .from(schema.people)
    .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
    .where(and(eq(schema.user.username, username.toLowerCase()), eq(schema.people.isSelf, true)))
  if (!row) return null
  const isSelf = row.person.ownerId === viewerId
  if (!isSelf && (await blockedWith(viewerId)).has(row.person.ownerId)) return null
  const rel = isSelf
    ? { following: false, followedBy: false, friends: false }
    : await relation(viewerId, row.person.ownerId)
  if (!visibleTo(row.person.visibility, isSelf, rel.friends))
    return { hidden: true as const, row, rel }
  const [loves, [taste], saved, counts] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, row.person.id))
      .orderBy(asc(schema.loves.createdAt)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, row.person.id)),
    db
      .select()
      .from(schema.savedPicks)
      .where(eq(schema.savedPicks.personId, row.person.id))
      .orderBy(desc(schema.savedPicks.createdAt)),
    followCounts(row.person.ownerId),
  ])
  return { hidden: false as const, row, rel, isSelf, loves, taste: taste ?? null, saved, counts }
}

export async function followCounts(userId: string) {
  const [row] = await db.execute<{ followers: number; following: number }>(sql`
    select
      (select count(*)::int from ${schema.follows} where followee_id = ${userId}) as followers,
      (select count(*)::int from ${schema.follows} where follower_id = ${userId}) as following`)
  return { followers: Number(row?.followers ?? 0), following: Number(row?.following ?? 0) }
}

/** Saves a piece of news for someone and tells their open pages at once. */
export async function notify(input: {
  userId: string
  kind: NotificationKind
  actorId?: string | null
  chatId?: string | null
  data?: Record<string, unknown>
}) {
  if (input.actorId && input.actorId === input.userId) return
  if (input.actorId && (await blockedWith(input.userId)).has(input.actorId)) return
  const [row] = await db
    .insert(schema.notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      actorId: input.actorId ?? null,
      chatId: input.chatId ?? null,
      data: input.data ?? {},
    })
    .returning({ id: schema.notifications.id })
  await publish(topic.user(input.userId), "notification", { id: row?.id, kind: input.kind })
}

/** People someone is friends with (they follow each other), as cards. */
export async function friendsOf(userId: string): Promise<PersonCard[]> {
  const rows = await db.execute<{ id: string }>(sql`
    select a.followee_id as id from ${schema.follows} a
    join ${schema.follows} b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
    where a.follower_id = ${userId}`)
  const ids = rows.map((r) => r.id)
  return cardsOf(ids)
}

export async function cardsOf(userIds: string[]): Promise<PersonCard[]> {
  if (!userIds.length) return []
  const rows = await db
    .select(cardColumns)
    .from(schema.people)
    .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
    .where(and(inArray(schema.people.ownerId, userIds), eq(schema.people.isSelf, true)))
  return rows.map(({ visibility: _v, ...card }) => card)
}

/**
 * People with taste like yours among everyone here: the most shared loves and picks (Qloo ids),
 * cheap enough to rank the whole room; the exact match comes from Qloo on their profile.
 */
export async function tasteTwins(
  userId: string,
  limit = 8,
  /** The radar only shows people who turned it on. */
  opts: { radar?: boolean } = {},
): Promise<(PersonCard & { shared: number })[]> {
  const onRadar = opts.radar ? sql`and p.radar` : sql``
  const rows = await db.execute<{ owner_id: string; shared: number }>(sql`
    with mine as (
      select l.qloo_id from ${schema.loves} l join ${schema.people} p on p.id = l.person_id
      where p.owner_id = ${userId} and p.is_self
      union
      select (pick->>'qlooId') from ${schema.tastes} t
      join ${schema.people} p on p.id = t.person_id,
      jsonb_each(coalesce(t.picks, '{}'::jsonb)) as d(domain, list), jsonb_array_elements(d.list) as pick
      where p.owner_id = ${userId} and p.is_self
    ),
    theirs as (
      select p.owner_id, l.qloo_id from ${schema.loves} l join ${schema.people} p on p.id = l.person_id
      where p.is_self and p.visibility = 'public' and p.owner_id <> ${userId} ${onRadar}
      union
      select p.owner_id, (pick->>'qlooId') from ${schema.tastes} t
      join ${schema.people} p on p.id = t.person_id,
      jsonb_each(coalesce(t.picks, '{}'::jsonb)) as d(domain, list), jsonb_array_elements(d.list) as pick
      where p.is_self and p.visibility = 'public' and p.owner_id <> ${userId} ${onRadar}
    )
    select theirs.owner_id, count(*)::int as shared from theirs
    join mine on mine.qloo_id = theirs.qloo_id
    group by theirs.owner_id order by shared desc limit ${limit}`)
  const cards = await cardsOf(rows.map((r) => r.owner_id))
  const shared = new Map(rows.map((r) => [r.owner_id, Number(r.shared)]))
  const blocked = await blockedWith(userId)
  return cards
    .filter((c) => !blocked.has(c.userId))
    .map((c) => ({ ...c, shared: shared.get(c.userId) ?? 0 }))
    .sort((a, b) => b.shared - a.shared)
}

export type Match = {
  percent: number
  /** Taste words you share, strongest first. */
  words: string[]
  /** Loves you both have. */
  loves: { qlooId: string; name: string; image: string | null; type: string }[]
  callId: string | null
}

/**
 * How well two tastes match: Qloo's compare of both people's loves gives the taste words they
 * share and the ones only one has; the share in common (two Afrobeats fans ≈ 0.77, Afrobeats and
 * metal ≈ 0.33 on 2026-10-22) reads as a percentage, scaled so a strong match lands near 90.
 */
export async function matchOf(
  a: {
    userId: string
    loves: { qlooId: string; name: string; imageUrl: string | null; type: string }[]
  },
  b: { loves: { qlooId: string }[] },
): Promise<Match | null> {
  if (!a.loves.length || !b.loves.length) return null
  const result = await compare(
    { a: a.loves.map((l) => l.qlooId), b: b.loves.map((l) => l.qlooId) },
    { userId: a.userId, purpose: "How well two tastes match" },
  ).catch(() => null)
  if (!result) return null
  const unique = (names: string[]) => [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const shared = unique(result.data.shared.map((s) => s.name))
  const total = shared.length + unique(result.data.onlyA).length + unique(result.data.onlyB).length
  const ratio = total ? shared.length / total : 0
  const theirs = new Set(b.loves.map((l) => l.qlooId))
  return {
    percent: Math.max(1, Math.min(99, Math.round(ratio * 115))),
    words: shared.slice(0, 8),
    loves: a.loves
      .filter((l) => theirs.has(l.qlooId))
      .map((l) => ({ qlooId: l.qlooId, name: l.name, image: l.imageUrl, type: l.type })),
    callId: result.call.callId,
  }
}

/** Everything the People screen opens with. */
export async function peopleHome(userId: string) {
  const [self] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  const [friends, twins, circles, [unread], [taste]] = await Promise.all([
    friendsOf(userId),
    tasteTwins(userId),
    db.execute<{ id: string; name: string | null; member_ids: string[] }>(sql`
      select c.id, c.name, array_agg(m2.user_id order by m2.joined_at) as member_ids
      from ${schema.chats} c
      join ${schema.chatMembers} m on m.chat_id = c.id and m.user_id = ${userId}
      join ${schema.chatMembers} m2 on m2.chat_id = c.id
      where c.kind = 'circle'
      group by c.id, c.name, c.last_active_at
      order by c.last_active_at desc limit 20`),
    db.execute<{ n: number }>(sql`
      select count(*)::int as n from ${schema.notifications}
      where user_id = ${userId} and read_at is null`),
    self
      ? db
          .select({ picks: schema.tastes.picks })
          .from(schema.tastes)
          .where(eq(schema.tastes.personId, self.id))
      : Promise.resolve([] as { picks: null }[]),
  ])
  const faces = new Map(
    (await cardsOf([...new Set(circles.flatMap((c) => c.member_ids))])).map((c) => [c.userId, c]),
  )
  // People in culture with your taste (Qloo's person picks), linked to where they post.
  const figures = (
    (
      taste?.picks as Record<
        string,
        {
          qlooId: string
          name: string
          image: string | null
          caption: string | null
          links?: Record<string, string>
        }[]
      > | null
    )?.person ?? []
  )
    .slice(0, 8)
    .map((p) => ({
      id: p.qlooId,
      name: p.name,
      image: p.image,
      caption: p.caption,
      link: p.links?.open ?? null,
    }))
  const after = await lastEventId(topic.user(userId))
  // Your own taste's artwork, for the game tiles (loves first, then picks).
  const [loveArt, [lounge]] = await Promise.all([
    self
      ? db
          .select({ image: schema.loves.imageUrl })
          .from(schema.loves)
          .where(eq(schema.loves.personId, self.id))
          .orderBy(desc(schema.loves.weight))
          .limit(8)
      : Promise.resolve([] as { image: string | null }[]),
    db.execute<{ id: string; member: boolean; members: number }>(sql`
      select c.id,
        exists(select 1 from ${schema.chatMembers} m where m.chat_id = c.id and m.user_id = ${userId}) as member,
        (select count(*)::int from ${schema.chatMembers} m where m.chat_id = c.id) as members
      from ${schema.chats} c where c.invite_token = ${GAMES.lounge.token}`),
  ])
  const pickArt = Object.values(
    (taste?.picks as Record<string, { image: string | null }[]> | null) ?? {},
  )
    .flat()
    .map((p) => p.image)
  const art = [...new Set([...loveArt.map((l) => l.image), ...pickArt].filter(Boolean))].slice(
    0,
    8,
  ) as string[]
  return {
    art,
    lounge: lounge
      ? { id: lounge.id, member: Boolean(lounge.member), members: Number(lounge.members) - 1 }
      : null,
    self,
    after,
    friends,
    twins: twins.filter((t) => !friends.some((f) => f.userId === t.userId)),
    circles: circles.map((c) => ({
      id: c.id,
      name: c.name ?? "Circle",
      members: c.member_ids.flatMap((id) => {
        const face = faces.get(id)
        return face ? [face] : []
      }),
    })),
    unread: Number(unread?.n ?? 0),
    figures,
  }
}

/**
 * The taste-twin radar (W10): people here whose taste is closest to yours (the most shared loves
 * and picks), and public figures Qloo predicts for your taste, with where they post.
 */
export async function radarOf(userId: string) {
  const [self] = await db
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  const [twins, [taste]] = await Promise.all([
    tasteTwins(userId, 10, { radar: true }),
    self
      ? db
          .select({ picks: schema.tastes.picks })
          .from(schema.tastes)
          .where(eq(schema.tastes.personId, self.id))
      : Promise.resolve([] as { picks: null }[]),
  ])
  const persons =
    (
      taste?.picks as Record<
        string,
        {
          qlooId: string
          name: string
          image: string | null
          caption: string | null
          links?: Record<string, string>
        }[]
      > | null
    )?.person ?? []
  return {
    twins,
    figures: persons.slice(0, 10).map((p) => ({
      id: p.qlooId,
      name: p.name,
      image: p.image,
      caption: p.caption,
      link: p.links?.open ?? null,
    })),
  }
}
