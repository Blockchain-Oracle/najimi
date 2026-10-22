import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { chats } from "./chat"
import type { StoredPick, TasteWords } from "./taste"

/** Who follows whom (one way); two ways is friends. */
export const follows = pgTable(
  "follows",
  {
    followerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followeeId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId),
  ],
)

export type NotificationKind =
  | "follow"
  | "joined"
  | "mention"
  | "message"
  | "invite"
  /** Someone finished a game about your taste. */
  | "played"
  /** Your circle's daily drop is up. */
  | "drop"
  /** A booking changed (confirmed, failed, cancelled). */
  | "booking"
  /** Today's feed tune-up is ready. */
  | "tuneup"

/** Your news (the inbox): a follow, someone joining your circle, a mention, a new DM. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text().$type<NotificationKind>().notNull(),
    /** Who did it (gone if they deleted their account). */
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    chatId: uuid().references(() => chats.id, { onDelete: "cascade" }),
    data: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
)

/**
 * A circle's taste: every member's loves counted equally, read by Qloo like one person's. The
 * words they share (compare), and picks for all of them (the soundtrack, a place for tonight).
 */
export const circleTastes = pgTable("circle_tastes", {
  chatId: uuid()
    .primaryKey()
    .references(() => chats.id, { onDelete: "cascade" }),
  /** The members' loves this was computed from; a different key means it's stale. */
  key: text().notNull(),
  shared: jsonb().$type<{ name: string; score: number | null }[]>(),
  words: jsonb().$type<TasteWords>(),
  picks: jsonb().$type<Record<string, StoredPick[]>>(),
  computedAt: timestamp({ withTimezone: true }),
})

/** A browser or installed app that takes Web Push for someone (W24), until it says it's gone. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lastOkAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("push_endpoint_idx").on(t.endpoint), index("push_user_idx").on(t.userId)],
)

/** Someone they never want to see or hear from again (W25). */
export const blocks = pgTable(
  "blocks",
  {
    blockerId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    blockedId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("blocks_pair_idx").on(t.blockerId, t.blockedId),
    index("blocks_blocked_idx").on(t.blockedId),
  ],
)

/** A report about a person or a message, kept for review (W25). */
export const reports = pgTable(
  "reports",
  {
    id: uuid().defaultRandom().primaryKey(),
    reporterId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    targetId: text().references(() => user.id, { onDelete: "set null" }),
    messageId: text(),
    chatId: uuid(),
    reason: text().$type<"spam" | "abuse" | "fake" | "other">().notNull(),
    note: text(),
    /** When someone looked at it (the owner gets an email per report). */
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reports_target_idx").on(t.targetId)],
)
