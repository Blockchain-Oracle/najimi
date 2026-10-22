import "server-only"
import { db, schema } from "@najimi/db"
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

/*
 * Rooms as a person sees them: the ones they're in. Every room route checks membership through
 * these, never ownership alone (a circle has many people in it).
 */

export type ChatRow = typeof schema.chats.$inferSelect

/** The room, when this person is in it (null otherwise: unknown to them). */
export async function ownedChat(userId: string, chatId: string): Promise<ChatRow | null> {
  const [row] = await db
    .select({ chat: schema.chats })
    .from(schema.chatMembers)
    .innerJoin(schema.chats, eq(schema.chats.id, schema.chatMembers.chatId))
    .where(and(eq(schema.chatMembers.chatId, chatId), eq(schema.chatMembers.userId, userId)))
  return row?.chat ?? null
}

export async function isMember(chatId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ chatId: schema.chatMembers.chatId })
    .from(schema.chatMembers)
    .where(and(eq(schema.chatMembers.chatId, chatId), eq(schema.chatMembers.userId, userId)))
  return Boolean(row)
}

/** Any room with this id, whoever is in it (to refuse an id someone else already took). */
export async function chatExists(chatId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
  return Boolean(row)
}

/** A new conversation with Najimi, and its person in it. */
export async function createAgentRoom(input: {
  id: string
  userId: string
  personId: string
  locale: string
  mode: ChatRow["mode"]
}): Promise<ChatRow | null> {
  return db.transaction(async (tx) => {
    const [chat] = await tx
      .insert(schema.chats)
      .values({
        id: input.id,
        ownerId: input.userId,
        kind: "agent",
        personId: input.personId,
        locale: input.locale,
        mode: input.mode,
      })
      .onConflictDoNothing()
      .returning()
    if (!chat) return null
    await tx
      .insert(schema.chatMembers)
      .values({ chatId: chat.id, userId: input.userId, role: "owner" })
    return chat
  })
}

export type ChatListItem = {
  id: string
  title: string | null
  name: string | null
  kind: ChatRow["kind"]
  status: ChatRow["status"]
  lastActiveAt: Date
  /** A DM's other person (their name is the DM's name). */
  other: string | null
}

/** The rooms someone is in, most recently active first; `q` searches titles, circle names and people. */
export async function chatsOf(
  userId: string,
  opts: { q?: string; limit?: number; kind?: ChatRow["kind"] } = {},
): Promise<ChatListItem[]> {
  const other = sql<string | null>`(
    select ${schema.people.name} from ${schema.chatMembers} as m
    join ${schema.people} on ${schema.people.ownerId} = m.user_id and ${schema.people.isSelf}
    where m.chat_id = ${schema.chats.id} and m.user_id <> ${userId}
    limit 1
  )`
  const q = opts.q ? `%${opts.q.replace(/[%_]/g, "")}%` : null
  return db
    .select({
      id: schema.chats.id,
      title: schema.chats.title,
      name: schema.chats.name,
      kind: schema.chats.kind,
      status: schema.chats.status,
      lastActiveAt: schema.chats.lastActiveAt,
      other,
    })
    .from(schema.chatMembers)
    .innerJoin(schema.chats, eq(schema.chats.id, schema.chatMembers.chatId))
    .where(
      and(
        eq(schema.chatMembers.userId, userId),
        opts.kind ? eq(schema.chats.kind, opts.kind) : undefined,
        q
          ? or(ilike(schema.chats.title, q), ilike(schema.chats.name, q), sql`${other} ilike ${q}`)
          : undefined,
      ),
    )
    .orderBy(desc(schema.chats.lastActiveAt))
    .limit(opts.limit ?? 50)
}

const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16)

/** A new circle: its name, its starter as owner, the friends they brought, and an invite link. */
export async function createCircle(input: {
  ownerId: string
  name: string
  memberIds: string[]
  locale: string
}): Promise<ChatRow> {
  return db.transaction(async (tx) => {
    const [chat] = await tx
      .insert(schema.chats)
      .values({
        ownerId: input.ownerId,
        kind: "circle",
        name: input.name,
        locale: input.locale,
        inviteToken: token(),
      })
      .returning()
    if (!chat) throw new Error("Couldn't start the circle")
    const members = [...new Set([input.ownerId, ...input.memberIds])]
    await tx.insert(schema.chatMembers).values(
      members.map((userId) => ({
        chatId: chat.id,
        userId,
        role: userId === input.ownerId ? ("owner" as const) : ("member" as const),
      })),
    )
    return chat
  })
}

/** The DM between two people: the one they already have, or a new one. */
export async function dmWith(viewerId: string, otherId: string, locale: string): Promise<ChatRow> {
  const [existing] = await db.execute<{ id: string }>(sql`
    select c.id from ${schema.chats} c
    join ${schema.chatMembers} a on a.chat_id = c.id and a.user_id = ${viewerId}
    join ${schema.chatMembers} b on b.chat_id = c.id and b.user_id = ${otherId}
    where c.kind = 'dm' limit 1`)
  if (existing) {
    const found = await ownedChat(viewerId, existing.id)
    if (found) return found
  }
  return db.transaction(async (tx) => {
    const [chat] = await tx
      .insert(schema.chats)
      .values({ ownerId: viewerId, kind: "dm", locale })
      .returning()
    if (!chat) throw new Error("Couldn't start the conversation")
    await tx.insert(schema.chatMembers).values([
      { chatId: chat.id, userId: viewerId, role: "owner" },
      { chatId: chat.id, userId: otherId, role: "member" },
    ])
    return chat
  })
}

/** Joins a circle by its invite link; returns the circle (and whether they were already in). */
export async function joinByToken(inviteToken: string, userId: string) {
  const [chat] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.inviteToken, inviteToken), eq(schema.chats.kind, "circle")))
  if (!chat) return null
  const added = await db
    .insert(schema.chatMembers)
    .values({ chatId: chat.id, userId, role: "member" })
    .onConflictDoNothing()
    .returning({ userId: schema.chatMembers.userId })
  return { chat, joined: added.length > 0 }
}

export type Member = {
  userId: string
  role: "owner" | "member"
  name: string
  username: string | null
  look: string | null
  aura: { c1: string; c2: string; c3: string } | null
  city: string | null
}

/** Who's in a room, with their faces (from their own profile). */
export async function membersOf(chatId: string): Promise<Member[]> {
  const rows = await db
    .select({
      userId: schema.chatMembers.userId,
      role: schema.chatMembers.role,
      name: schema.people.name,
      username: schema.user.displayUsername,
      look: schema.people.look,
      aura: schema.people.aura,
      city: schema.people.city,
    })
    .from(schema.chatMembers)
    .innerJoin(schema.user, eq(schema.user.id, schema.chatMembers.userId))
    .leftJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.chatMembers.userId), eq(schema.people.isSelf, true)),
    )
    .where(eq(schema.chatMembers.chatId, chatId))
    .orderBy(asc(schema.chatMembers.joinedAt))
  return rows.map((r) => ({ ...r, name: r.name ?? r.username ?? "Someone" }))
}

/**
 * What a circle shares: loves two or more of them have, and the taste words most of them are
 * (each member's words from Qloo, counted across the room). Cheap: read from stored tastes.
 */
export async function overlapOf(chatId: string) {
  const members = await db
    .select({ personId: schema.people.id, name: schema.people.name })
    .from(schema.chatMembers)
    .innerJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.chatMembers.userId), eq(schema.people.isSelf, true)),
    )
    .where(eq(schema.chatMembers.chatId, chatId))
  if (members.length < 2) return { loves: [], words: [] }
  const ids = members.map((m) => m.personId)
  const [loves, tastes] = await Promise.all([
    db
      .select({
        personId: schema.loves.personId,
        qlooId: schema.loves.qlooId,
        name: schema.loves.name,
        image: schema.loves.imageUrl,
      })
      .from(schema.loves)
      .where(inArray(schema.loves.personId, ids)),
    db
      .select({ personId: schema.tastes.personId, words: schema.tastes.words })
      .from(schema.tastes)
      .where(inArray(schema.tastes.personId, ids)),
  ])
  const nameOf = new Map(members.map((m) => [m.personId, m.name]))
  const byLove = new Map<string, { name: string; image: string | null; who: string[] }>()
  for (const l of loves) {
    const row = byLove.get(l.qlooId) ?? { name: l.name, image: l.image, who: [] }
    row.who.push(nameOf.get(l.personId) ?? "")
    byLove.set(l.qlooId, row)
  }
  const wordCount = new Map<string, number>()
  for (const t of tastes)
    for (const list of Object.values(t.words ?? {}))
      for (const w of new Set(list as string[])) wordCount.set(w, (wordCount.get(w) ?? 0) + 1)
  const half = Math.ceil(members.length / 2)
  return {
    loves: [...byLove.entries()]
      .filter(([, v]) => v.who.length >= 2)
      .map(([qlooId, v]) => ({ qlooId, ...v }))
      .slice(0, 12),
    words: [...wordCount.entries()]
      .filter(([, n]) => n >= Math.max(2, half))
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w)
      .slice(0, 10),
  }
}
