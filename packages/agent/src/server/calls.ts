import { CALLS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { CallLine } from "@najimi/db/schema"
import { publish, topic } from "@najimi/live"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { publishMessage, toUI } from "./room"

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
      rows.map((r) => publish(topic.user(r.userId), "notification", { id: r.id, kind: "call" })),
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
  const [call] = await db
    .update(schema.calls)
    .set({ endedAt: new Date(), ...(summary ? { summary } : {}) })
    .where(and(eq(schema.calls.room, room), isNull(schema.calls.endedAt)))
    .returning()
  if (!call) return null
  const minutes = Math.max(1, Math.round((Date.now() - call.startedAt.getTime()) / 60_000))
  await postCard(call, timed ? `Call ended · ${minutes} min` : "Call ended")
  return call
}

export async function callByRoom(room: string): Promise<Call | null> {
  const [row] = await db.select().from(schema.calls).where(eq(schema.calls.room, room))
  return row ?? null
}
