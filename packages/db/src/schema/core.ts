import {
  bigserial,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

/** The owner column every owned row carries: a user (guests included) that cascades on delete. */
export const owner = () =>
  text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "waiting",
  "done",
  "failed",
  "cancelled",
])

/** One piece of slow work (computing a taste, making an image or a video), watched live. */
export const runs = pgTable(
  "runs",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    kind: text().notNull(),
    /** The chat and tool call that started it, when one did (media cards subscribe by run id). */
    chatId: uuid(),
    toolCallId: text(),
    /** What the run is about, for its card ({ personId }, { creationIds }, …). */
    subject: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    status: runStatus().default("queued").notNull(),
    error: text(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("runs_owner_idx").on(t.ownerId), index("runs_chat_idx").on(t.chatId)],
)

/**
 * Everything that happens live, by topic: a run's steps (`run:<id>`), a room's messages as they
 * stream (`room:<id>`), a person's own news (`user:<id>`). Append-only, so a reconnecting page
 * replays exactly what it missed (ids are ordered); each row is announced on the live channel in
 * the same transaction, and old rows are swept nightly.
 */
export const liveEvents = pgTable(
  "live_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    topic: text().notNull(),
    type: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("live_events_topic_idx").on(t.topic, t.id)],
)
