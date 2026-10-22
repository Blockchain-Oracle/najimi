import "server-only"
import { db, schema } from "@najimi/db"
import { and, desc, eq, ilike } from "drizzle-orm"

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
  kind: ChatRow["kind"]
  status: ChatRow["status"]
  lastActiveAt: Date
}

/** The rooms someone is in, most recently active first; `q` searches titles. */
export async function chatsOf(
  userId: string,
  opts: { q?: string; limit?: number } = {},
): Promise<ChatListItem[]> {
  return db
    .select({
      id: schema.chats.id,
      title: schema.chats.title,
      kind: schema.chats.kind,
      status: schema.chats.status,
      lastActiveAt: schema.chats.lastActiveAt,
    })
    .from(schema.chatMembers)
    .innerJoin(schema.chats, eq(schema.chats.id, schema.chatMembers.chatId))
    .where(
      and(
        eq(schema.chatMembers.userId, userId),
        opts.q ? ilike(schema.chats.title, `%${opts.q.replace(/[%_]/g, "")}%`) : undefined,
      ),
    )
    .orderBy(desc(schema.chats.lastActiveAt))
    .limit(opts.limit ?? 50)
}
