import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
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
