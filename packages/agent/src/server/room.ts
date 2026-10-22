import { db, schema, type Tx } from "@najimi/db"
import { publish, topic } from "@najimi/live"
import { and, asc, desc, eq, lt } from "drizzle-orm"
import type { ChatMeta, NajimiUIMessage } from "../ui-message"

/*
 * A room's messages, one row each, as AI SDK UIMessages; and the room's live topic, where every
 * new or changed message is sent whole (pages replace it by id), with the room's status.
 */

type MessageRow = typeof schema.messages.$inferSelect

export const toUI = (row: MessageRow): NajimiUIMessage => ({
  id: row.id,
  role: row.role,
  parts: row.parts as NajimiUIMessage["parts"],
  metadata: {
    ...((row.metadata ?? {}) as ChatMeta),
    authorId: row.authorId,
    status: row.status as ChatMeta["status"],
    createdAt: row.createdAt.getTime(),
  },
})

/** A room's messages, oldest first: the newest `limit`, or the `limit` before a time. */
export async function roomMessages(
  chatId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<NajimiUIMessage[]> {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.chatId, chatId),
        opts.before ? lt(schema.messages.createdAt, opts.before) : undefined,
      ),
    )
    .orderBy(desc(schema.messages.createdAt))
    .limit(opts.limit ?? 200)
  return rows.reverse().map(toUI)
}

/** Every message, oldest first (what the agent reads; rooms are capped by the turn's context). */
export async function allMessages(chatId: string): Promise<NajimiUIMessage[]> {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
    .orderBy(asc(schema.messages.createdAt))
  return rows.map(toUI)
}

/** Sends a message (new or changed) to everyone in the room. */
export const publishMessage = (chatId: string, message: NajimiUIMessage, tx?: Tx) =>
  publish(topic.room(chatId), "message", { message }, tx)

/** Saves a message's parts and status, and sends it to the room. */
export async function saveAndPublish(
  chatId: string,
  message: NajimiUIMessage,
  status: NonNullable<ChatMeta["status"]>,
): Promise<void> {
  const { authorId: _a, status: _s, createdAt: _c, ...metadata } = message.metadata ?? {}
  await db
    .update(schema.messages)
    .set({ parts: message.parts, metadata, status })
    .where(eq(schema.messages.id, message.id))
  await publishMessage(chatId, { ...message, metadata: { ...message.metadata, status } })
}

/** The room's state (Najimi answering, waiting on someone, idle), saved and sent. */
export async function setRoomStatus(
  chatId: string,
  status: (typeof schema.chats.$inferSelect)["status"],
): Promise<void> {
  await db
    .update(schema.chats)
    .set({
      status,
      lastActiveAt: new Date(),
      ...(status === "generating" ? { turnStartedAt: new Date() } : {}),
      ...(status === "idle" ? { turnStartedAt: null } : {}),
    })
    .where(eq(schema.chats.id, chatId))
  await publish(topic.room(chatId), "status", { status })
}

/**
 * A game's card dealt into a room (by someone, or by Najimi for the daily drop), sent to everyone
 * in it. The card is a finished `startGame` tool part, so it reads the same as one Najimi dealt.
 */
export async function postGameCard(
  chatId: string,
  card: {
    roundId: string
    token: string
    kind: "wavelength" | "knowme" | "twins" | "blind"
    title: string
    count: number
    subject: { name: string; look: string | null } | null
    about?: string
    /** A line over the title ("Today's drop"). */
    note?: string | null
    startedBy: string
    /** Counts as the room being active (Najimi's own drops don't, or they'd never stop). */
    bump?: boolean
  },
): Promise<void> {
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: `msg_game_${card.roundId}`,
      chatId,
      role: "assistant",
      parts: [
        {
          type: "tool-startGame",
          toolCallId: `game_${card.roundId.slice(0, 12)}`,
          state: "output-available",
          input: { kind: card.kind, ...(card.about ? { about: card.about } : {}) },
          output: {
            token: card.token,
            kind: card.kind,
            title: card.title,
            subject: card.kind === "twins" ? null : card.subject,
            count: card.count,
            note: card.note ?? null,
          },
        },
      ],
      metadata: { startedBy: card.startedBy },
    })
    .onConflictDoNothing()
    .returning()
  if (row) await publishMessage(chatId, toUI(row))
  if (row && card.startedBy !== "najimi")
    await notifyGame(chatId, card.startedBy, { token: card.token, title: card.title })
  if (card.bump ?? true)
    await db
      .update(schema.chats)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.chats.id, chatId))
}

/**
 * Someone dealt a game in a circle: everyone else in it hears about it (inbox and push). The daily
 * drop has its own notice.
 */
export async function notifyGame(
  chatId: string,
  startedBy: string,
  game: { token: string; title: string },
): Promise<void> {
  const [chat] = await db
    .select({ kind: schema.chats.kind, name: schema.chats.name })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
  if (chat?.kind !== "circle") return
  const members = await db
    .select({ userId: schema.chatMembers.userId })
    .from(schema.chatMembers)
    .where(eq(schema.chatMembers.chatId, chatId))
  const others = members.filter((m) => m.userId !== startedBy)
  if (!others.length) return
  const rows = await db
    .insert(schema.notifications)
    .values(
      others.map((m) => ({
        userId: m.userId,
        kind: "game" as const,
        actorId: startedBy,
        chatId,
        data: { token: game.token, title: game.title, name: chat.name },
      })),
    )
    .returning({ id: schema.notifications.id, userId: schema.notifications.userId })
  await Promise.all(
    rows.map((r) => publish(topic.user(r.userId), "notification", { id: r.id, kind: "game" })),
  )
}
