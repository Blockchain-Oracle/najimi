import { CALLS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { CallLine } from "@najimi/db/schema"
import { enqueue } from "@najimi/jobs"
import { publish, topic } from "@najimi/live"
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm"
import { publishMessage, toUI } from "./room"
import { charge } from "./usage"

/*
 * Calls in a circle or DM (LiveKit): one live call per chat at a time, shown in the chat as a card
 * (who started it, Join; then how long it ran and Najimi's summary), with the other members told.
 * The voice service adds what's said and ends it; the web app starts it and brings Najimi in.
 */

export type Call = typeof schema.calls.$inferSelect

const cardId = (callId: string) => `sys_call_${callId}`

/** The chat's call that's still going, if any (one left open for hours is closed first). */
export async function liveCall(chatId: string): Promise<Call | null> {
  const [row] = await db
    .select()
    .from(schema.calls)
    .where(and(eq(schema.calls.chatId, chatId), isNull(schema.calls.endedAt)))
    .orderBy(desc(schema.calls.startedAt))
    .limit(1)
  if (row && Date.now() - row.startedAt.getTime() > CALLS.maxMs) {
    await endCall(row.room, null, { timed: false })
    return null
  }
  return row ?? null
}

async function postCard(call: Call, text: string) {
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: cardId(call.id),
      chatId: call.chatId,
      role: "system",
      parts: [{ type: "text", text }],
      metadata: {
        call: {
          id: call.id,
          live: !call.endedAt,
          najimi: call.najimi,
          startedAt: call.startedAt.toISOString(),
          endedAt: call.endedAt?.toISOString() ?? null,
          summary: call.summary,
        },
      },
    })
    .onConflictDoUpdate({
      target: schema.messages.id,
      set: {
        parts: [{ type: "text", text }],
        metadata: {
          call: {
            id: call.id,
            live: !call.endedAt,
            najimi: call.najimi,
            startedAt: call.startedAt.toISOString(),
            endedAt: call.endedAt?.toISOString() ?? null,
            summary: call.summary,
          },
        },
      },
    })
    .returning()
  if (row) await publishMessage(call.chatId, toUI(row))
}

/** Starts the chat's call (or returns the one already going), with its card and the members told. */
export async function startCall(chatId: string, userId: string, name: string): Promise<Call> {
  const going = await liveCall(chatId)
  if (going) return going
  const [call] = await db
    .insert(schema.calls)
    .values({ chatId, room: `najimi-${chatId}-${Date.now().toString(36)}`, startedBy: userId })
    .onConflictDoNothing()
    .returning()
  // Someone else started it a moment ago: join theirs.
  if (!call) {
    const theirs = await liveCall(chatId)
    if (theirs) return theirs
    throw new Error("Couldn't start the call")
  }
  await postCard(call, `${name} started a call`)
  const [chat] = await db
    .select({ name: schema.chats.name, kind: schema.chats.kind })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
  const members = await db
    .select({ userId: schema.chatMembers.userId })
    .from(schema.chatMembers)
    .where(eq(schema.chatMembers.chatId, chatId))
  const others = members.filter((m) => m.userId !== userId)
  if (others.length) {
    const rows = await db
      .insert(schema.notifications)
      .values(
        others.map((m) => ({
          userId: m.userId,
          kind: "call" as const,
          actorId: userId,
          chatId,
          data: { text: `${name} started a call`, callId: call.id },
        })),
      )
      .returning({ id: schema.notifications.id, userId: schema.notifications.userId })
    await Promise.all(
      rows.map((r) =>
        publish(topic.user(r.userId), "notification", {
          id: r.id,
          kind: "call",
          call: {
            chatId,
            callId: call.id,
            who: name,
            chat: chat?.kind === "circle" ? chat.name : null,
          },
        }),
      ),
    )
  }
  await db.update(schema.chats).set({ lastActiveAt: new Date() }).where(eq(schema.chats.id, chatId))
  return call
}

/** Najimi has been asked into the call. */
export async function markNajimi(callId: string) {
  const [call] = await db
    .update(schema.calls)
    .set({ najimi: true })
    .where(eq(schema.calls.id, callId))
    .returning()
  if (call) await postCard(call, "Najimi joined the call")
  return call ?? null
}

/** What someone said, kept for the summary (the newest lines only). */
export async function addLine(room: string, line: CallLine) {
  await db
    .update(schema.calls)
    .set({
      transcript: sql`(
        select coalesce(jsonb_agg(l), '[]'::jsonb) from (
          select l from jsonb_array_elements(${schema.calls.transcript} || ${JSON.stringify([line])}::jsonb) as l
          offset greatest(jsonb_array_length(${schema.calls.transcript}) + 1 - ${CALLS.transcriptMax}, 0)
        ) as kept
      )`,
    })
    .where(eq(schema.calls.room, room))
}

/** The call is over: its card says how long it ran, and Najimi's summary when it was there. */
export async function endCall(
  room: string,
  summary: string | null = null,
  { timed = true }: { timed?: boolean } = {},
) {
  const [ended] = await db
    .update(schema.calls)
    .set({ endedAt: new Date(), ...(summary ? { summary } : {}) })
    .where(and(eq(schema.calls.room, room), isNull(schema.calls.endedAt)))
    .returning()
  // Already closed (the last person left before Najimi finished writing): add the summary to it.
  const [call] = ended
    ? [ended]
    : summary
      ? await db
          .update(schema.calls)
          .set({ summary })
          .where(and(eq(schema.calls.room, room), isNull(schema.calls.summary)))
          .returning()
      : []
  if (!call?.endedAt) return null
  const minutes = Math.max(
    1,
    Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 60_000),
  )
  await postCard(call, timed ? `Call ended · ${minutes} min` : "Call ended")
  return call
}

export async function callByRoom(room: string): Promise<Call | null> {
  const [row] = await db.select().from(schema.calls).where(eq(schema.calls.room, room))
  return row ?? null
}

/** An answer's words, as speech: no markdown or links, the first sentence or two. */
export function spoken(text: string): string {
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const sentences = plain.match(/[^.!?]+[.!?]+/g) ?? [plain]
  return sentences.slice(0, 2).join(" ").trim().slice(0, 320)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Something asked out loud (in a call, or on a phone call Najimi was added to): it goes into the
 * chat as the asker's message, Najimi's usual turn answers it there (cards and all), and the first
 * line or two of that answer comes back to be spoken. Each question is one of the asker's turns.
 */
export async function askAloud({
  chatId,
  userId,
  text,
  where,
  waitMs = CALLS.answerWaitMs,
}: {
  chatId: string
  userId: string
  text: string
  /** What Najimi is told about where it's being asked, so it answers in a speakable way. */
  where: string
  waitMs?: number
}): Promise<string | null> {
  const [user] = await db
    .select({ anonymous: schema.user.isAnonymous })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
  if (!user) return null
  if (!(await charge(userId, Boolean(user.anonymous), "turns")))
    return "That's all I can do for today, sorry."
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      chatId,
      role: "user",
      authorId: userId,
      parts: [{ type: "text", text }],
      metadata: {
        screen: {
          where: "call",
          label: `${where}: answer in one or two short spoken sentences, and let cards carry the rest`,
        },
      },
    })
    .returning()
  if (!row) return null
  await publishMessage(chatId, toUI(row))
  await enqueue("agentTurn", { chatId }, chatId)
  const until = Date.now() + waitMs
  while (Date.now() < until) {
    await sleep(1500)
    const [answer] = await db
      .select({ parts: schema.messages.parts, status: schema.messages.status })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.chatId, chatId),
          eq(schema.messages.role, "assistant"),
          gt(schema.messages.createdAt, row.createdAt),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(1)
    if (answer && answer.status !== "streaming") {
      const words = (answer.parts as { type: string; text?: string }[])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join(" ")
      return spoken(words) || "I've put it in the chat."
    }
  }
  return "I'm still looking; it'll land in the chat."
}
