import { db, schema } from "@najimi/db"
import type { PollOption } from "@najimi/db/schema"
import { publish, topic } from "@najimi/live"
import { and, asc, eq, inArray } from "drizzle-orm"
import { publishMessage, toUI } from "./room"

/*
 * Polls in a room (S17): anyone, or Najimi, asks the room to choose ("where tonight?"). The card
 * is a finished `startPoll` tool part, like a dealt game, so it reads the same whoever started
 * it; votes live in `poll_votes`, one per person, and every vote reaches the room live.
 */

export type PollCard = {
  pollId: string
  question: string
  options: PollOption[]
}

const optionId = (i: number) => `o${i + 1}`

/** The poll's row, and its card's output. */
async function insertPoll(input: {
  chatId: string
  createdBy: string | null
  question: string
  options: Omit<PollOption, "id">[]
}): Promise<PollCard> {
  const options = input.options.slice(0, 4).map((o, i) => ({ ...o, id: optionId(i) }))
  const [poll] = await db
    .insert(schema.polls)
    .values({
      chatId: input.chatId,
      createdBy: input.createdBy,
      question: input.question,
      options,
    })
    .returning({ id: schema.polls.id })
  if (!poll) throw new Error("Couldn't start the poll")
  return { pollId: poll.id, question: input.question, options }
}

/** Najimi's poll: the row only; the card is the tool part it's answering with. */
export const startPollForNajimi = (input: {
  chatId: string
  question: string
  options: Omit<PollOption, "id">[]
}) => insertPoll({ ...input, createdBy: null })

/** Someone's poll: the row and its card in the thread, sent to everyone in the room. */
export async function startPoll(input: {
  chatId: string
  userId: string
  question: string
  options: Omit<PollOption, "id">[]
}): Promise<PollCard> {
  const card = await insertPoll({ ...input, createdBy: input.userId })
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: `msg_poll_${card.pollId}`,
      chatId: input.chatId,
      role: "assistant",
      authorId: input.userId,
      parts: [
        {
          type: "tool-startPoll",
          toolCallId: `poll_${card.pollId.slice(0, 12)}`,
          state: "output-available",
          input: {
            question: card.question,
            options: card.options.map((o) => ({ label: o.label })),
          },
          output: card,
        },
      ],
      metadata: { startedBy: input.userId },
    })
    .returning()
  if (row) await publishMessage(input.chatId, toUI(row))
  await db
    .update(schema.chats)
    .set({ lastActiveAt: new Date() })
    .where(eq(schema.chats.id, input.chatId))
  return card
}

export type PollTally = {
  pollId: string
  question: string
  closed: boolean
  /** Who asked (null: Najimi). */
  by: { name: string; look: string | null } | null
  total: number
  mine: string | null
  options: (PollOption & { count: number; voters: { name: string; look: string | null }[] })[]
}

/** A poll as its card shows it: each choice's votes and faces, and the viewer's own vote. */
export async function pollTally(pollId: string, viewerId: string): Promise<PollTally | null> {
  const [poll] = await db.select().from(schema.polls).where(eq(schema.polls.id, pollId))
  if (!poll) return null
  const votes = await db
    .select({
      userId: schema.pollVotes.userId,
      optionId: schema.pollVotes.optionId,
      name: schema.people.name,
      look: schema.people.look,
    })
    .from(schema.pollVotes)
    .leftJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.pollVotes.userId), eq(schema.people.isSelf, true)),
    )
    .where(eq(schema.pollVotes.pollId, pollId))
    .orderBy(asc(schema.pollVotes.at))
  const [by] = poll.createdBy
    ? await db
        .select({ name: schema.people.name, look: schema.people.look })
        .from(schema.people)
        .where(and(eq(schema.people.ownerId, poll.createdBy), eq(schema.people.isSelf, true)))
    : []
  return {
    pollId: poll.id,
    question: poll.question,
    closed: Boolean(poll.closedAt),
    by: by ?? null,
    total: votes.length,
    mine: votes.find((v) => v.userId === viewerId)?.optionId ?? null,
    options: poll.options.map((o) => {
      const mine = votes.filter((v) => v.optionId === o.id)
      return {
        ...o,
        count: mine.length,
        voters: mine.map((v) => ({ name: v.name ?? "", look: v.look ?? null })),
      }
    }),
  }
}

/** A vote (or a changed one); the room hears about it at once. */
export async function vote(
  chatId: string,
  pollId: string,
  userId: string,
  optionId: string,
): Promise<boolean> {
  const [poll] = await db
    .select()
    .from(schema.polls)
    .where(and(eq(schema.polls.id, pollId), eq(schema.polls.chatId, chatId)))
  if (!poll || poll.closedAt || !poll.options.some((o) => o.id === optionId)) return false
  await db
    .insert(schema.pollVotes)
    .values({ pollId, userId, optionId })
    .onConflictDoUpdate({
      target: [schema.pollVotes.pollId, schema.pollVotes.userId],
      set: { optionId, at: new Date() },
    })
  await publish(topic.room(chatId), "poll", { pollId })
  return true
}

/** Open polls in a room with their counts, for Najimi's context ("the room voted for…"). */
export async function openPolls(chatId: string) {
  const list = await db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.chatId, chatId))
    .orderBy(asc(schema.polls.createdAt))
  const recent = list.slice(-3)
  if (!recent.length) return []
  const votes = await db
    .select({ pollId: schema.pollVotes.pollId, optionId: schema.pollVotes.optionId })
    .from(schema.pollVotes)
    .where(
      inArray(
        schema.pollVotes.pollId,
        recent.map((p) => p.id),
      ),
    )
  return recent.map((p) => ({
    question: p.question,
    options: p.options.map((o) => ({
      label: o.label,
      votes: votes.filter((v) => v.pollId === p.id && v.optionId === o.id).length,
    })),
  }))
}
