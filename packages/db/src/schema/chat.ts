import {
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
import { owner, timestamps } from "./core"
import { people } from "./taste"

/** A conversation. `messages` is the whole AI SDK UIMessage[] (tool parts and reasoning kept). */
export const chats = pgTable(
  "chats",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    /** Who the chat makes things for. */
    personId: uuid().references(() => people.id, { onDelete: "set null" }),
    title: text(),
    /** Replies, cards and the title are written in this language (rule 8). */
    locale: text().notNull(),
    mode: text().$type<"ask" | "auto" | "plan">().default("ask").notNull(),
    status: text().$type<"idle" | "generating" | "waiting">().default("idle").notNull(),
    turnStartedAt: timestamp({ withTimezone: true }),
    messages: jsonb().$type<unknown[]>().default([]).notNull(),
    lastActiveAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [index("chats_owner_active_idx").on(t.ownerId, t.lastActiveAt)],
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
    kind: text().$type<"creation" | "chat" | "person">().notNull(),
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
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
)
