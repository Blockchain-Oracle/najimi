import "server-only"
import type { NajimiUIMessage } from "@najimi/agent"
import { db, schema } from "@najimi/db"
import { and, desc, eq, ilike } from "drizzle-orm"

export type ChatRow = typeof schema.chats.$inferSelect

export async function ownedChat(userId: string, chatId: string): Promise<ChatRow | null> {
  const [row] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.ownerId, userId)))
  return row ?? null
}

/** Any chat with this id, whoever owns it (to refuse an id someone else already took). */
export async function chatExists(chatId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
  return Boolean(row)
}

export const messagesOf = (chat: ChatRow) => chat.messages as NajimiUIMessage[]

export async function saveMessages(
  chatId: string,
  messages: NajimiUIMessage[],
  status?: ChatRow["status"],
): Promise<void> {
  await db
    .update(schema.chats)
    .set({
      messages,
      lastActiveAt: new Date(),
      ...(status ? { status, ...(status === "idle" ? { turnStartedAt: null } : {}) } : {}),
    })
    .where(eq(schema.chats.id, chatId))
}

export type ChatListItem = {
  id: string
  title: string | null
  personId: string | null
  status: ChatRow["status"]
  lastActiveAt: Date
}

export async function chatsOf(
  userId: string,
  opts: { q?: string; limit?: number } = {},
): Promise<ChatListItem[]> {
  return db
    .select({
      id: schema.chats.id,
      title: schema.chats.title,
      personId: schema.chats.personId,
      status: schema.chats.status,
      lastActiveAt: schema.chats.lastActiveAt,
    })
    .from(schema.chats)
    .where(
      and(
        eq(schema.chats.ownerId, userId),
        opts.q ? ilike(schema.chats.title, `%${opts.q.replace(/[%_]/g, "")}%`) : undefined,
      ),
    )
    .orderBy(desc(schema.chats.lastActiveAt))
    .limit(opts.limit ?? 50)
}
