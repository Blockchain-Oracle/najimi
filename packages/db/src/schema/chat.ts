import { sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { owner, timestamps } from "./core"
import { people } from "./taste"

/**
 * A room: your conversation with Najimi (`agent`), a circle of friends with Najimi in it
 * (`circle`), or two people (`dm`). Its messages are rows in `messages`; who's in it is
 * `chat_members`.
 */
export const chats = pgTable(
  "chats",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    kind: text().$type<"agent" | "circle" | "dm">().default("agent").notNull(),
    /** A circle's name (agent chats use `title`, written by Najimi). */
    name: text(),
    /** A circle's invite link (`/join/<token>`); rotating it stops the old link. */
    inviteToken: text(),
    /** Anyone can find and join a public circle. */
    public: boolean().default(false).notNull(),
    /** Who the chat makes things for. */
    personId: uuid().references(() => people.id, { onDelete: "set null" }),
    title: text(),
    /** Replies, cards and the title are written in this language (rule 8). */
    locale: text().notNull(),
    mode: text().$type<"ask" | "auto" | "plan">().default("ask").notNull(),
    status: text()
      .$type<"idle" | "generating" | "waiting" | "stopping">()
      .default("idle")
      .notNull(),
    turnStartedAt: timestamp({ withTimezone: true }),
    lastActiveAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [
    index("chats_owner_active_idx").on(t.ownerId, t.lastActiveAt),
    uniqueIndex("chats_invite_idx").on(t.inviteToken),
  ],
)

/** Who is in a room, and how far they've read. */
export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: uuid()
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().$type<"owner" | "member">().default("member").notNull(),
    lastReadAt: timestamp({ withTimezone: true }),
    /** Pinned to the top of their chats (each person pins for themselves). */
    pinnedAt: timestamp({ withTimezone: true }),
    joinedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.chatId, t.userId] }),
    index("chat_members_user_idx").on(t.userId),
  ],
)

/**
 * One message in a room, as an AI SDK UIMessage (its parts: text, tool cards, approvals). The
 * agent's answer is one row updated as it streams; appends never rewrite the rest of the room.
 */
export const messages = pgTable(
  "messages",
  {
    id: text().primaryKey(),
    chatId: uuid()
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text().$type<"user" | "assistant" | "system">().notNull(),
    /** The person who wrote it (null for Najimi). Deleting their account deletes what they wrote. */
    authorId: text().references(() => user.id, { onDelete: "cascade" }),
    parts: jsonb().$type<unknown[]>().default([]).notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    /** done; streaming; waiting (a card needs an answer); resume (answered, Najimi carries on); failed. */
    status: text()
      .$type<"done" | "streaming" | "waiting" | "resume" | "failed">()
      .default("done")
      .notNull(),
    createdAt: timestamp({ withTimezone: true }).default(sql`clock_timestamp()`).notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("messages_chat_time_idx").on(t.chatId, t.createdAt)],
)

/**
 * A public link to one thing. A restyle's share shows the result only: the person's own photo is
 * never public. Revoked links stop working at once.
 */
export const shares = pgTable(
  "shares",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    token: text().notNull(),
    kind: text().$type<"creation" | "chat" | "person" | "wrapped">().notNull(),
    refId: uuid().notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("shares_token_idx").on(t.token), index("shares_ref_idx").on(t.refId)],
)

/**
 * What each person used today (rule 6), charged atomically when a tool runs and refunded when it
 * fails or is refused. `user_id = '*'` is the whole server's row (the global ceiling).
 */
export const usageDays = pgTable(
  "usage_days",
  {
    userId: text().notNull(),
    day: date().notNull(),
    turns: integer().default(0).notNull(),
    images: integer().default(0).notNull(),
    videos: integer().default(0).notNull(),
    /** Phone calls to venues, and hotel rooms held for payment (W26). */
    calls: integer().default(0).notNull(),
    holds: integer().default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
)

/** One choice in a poll; a thing from Qloo carries its id and art, so the card can open it. */
export type PollOption = {
  id: string
  label: string
  qlooId?: string | null
  image?: string | null
}

/**
 * A poll in a room, started by someone or by Najimi ("where should we go?"), shown as a card in
 * the thread (a finished `startPoll` tool part). Everyone in the room votes once and can change it.
 */
export const polls = pgTable(
  "polls",
  {
    id: uuid().defaultRandom().primaryKey(),
    chatId: uuid()
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    /** Who asked (null: Najimi). Deleting their account deletes the polls they started. */
    createdBy: text().references(() => user.id, { onDelete: "cascade" }),
    question: text().notNull(),
    options: jsonb().$type<PollOption[]>().notNull(),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("polls_chat_idx").on(t.chatId)],
)

export const pollVotes = pgTable(
  "poll_votes",
  {
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    optionId: text().notNull(),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.userId] })],
)

/** One thing said in a call, by whom (a member, or Najimi). */
export type CallLine = { at: string; userId: string | null; name: string; text: string }

/**
 * A voice call in a circle or a DM (LiveKit): who started it, whether Najimi was brought in, what
 * was said (Najimi hears each speaker separately), and the summary it leaves in the chat at the end.
 */
export const calls = pgTable(
  "calls",
  {
    id: uuid().defaultRandom().primaryKey(),
    chatId: uuid()
      .references(() => chats.id, { onDelete: "cascade" })
      .notNull(),
    /** The LiveKit room. */
    room: text().notNull(),
    startedBy: text().references(() => user.id, { onDelete: "set null" }),
    najimi: boolean().notNull().default(false),
    transcript: jsonb().$type<CallLine[]>().default([]).notNull(),
    summary: text(),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("calls_room_idx").on(t.room),
    index("calls_chat_idx").on(t.chatId, t.startedAt),
    // One live call per chat: two people tapping Call at once join the same one.
    uniqueIndex("calls_live_idx").on(t.chatId).where(sql`ended_at is null`),
  ],
)
