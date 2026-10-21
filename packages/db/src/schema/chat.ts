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
    workflowId: uuid().references(() => workflows.id, { onDelete: "set null" }),
    status: text().$type<"idle" | "generating" | "waiting">().default("idle").notNull(),
    turnStartedAt: timestamp({ withTimezone: true }),
    messages: jsonb().$type<unknown[]>().default([]).notNull(),
    forkedFromChatId: uuid(),
    forkedAtMessageId: text(),
    lastActiveAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [index("chats_owner_active_idx").on(t.ownerId, t.lastActiveAt)],
)

/** A recipe for a bigger job: the seven built-ins (no owner) and the ones people save and share. */
export const workflows = pgTable(
  "workflows",
  {
    id: uuid().defaultRandom().primaryKey(),
    slug: text().notNull(),
    /** Null for built-ins. */
    ownerId: text().references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().notNull(),
    category: text().notNull(),
    /** What a run asks for first ({ photo: true, person: true }). */
    needs: jsonb().$type<{ photo?: boolean; person?: boolean }>().default({}).notNull(),
    instructions: text().notNull(),
    coverCreationId: uuid(),
    public: boolean().default(false).notNull(),
    runsCount: integer().default(0).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("workflows_slug_idx").on(t.slug), index("workflows_owner_idx").on(t.ownerId)],
)

export const workflowFavourites = pgTable(
  "workflow_favourites",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workflowId: uuid()
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workflowId] })],
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
