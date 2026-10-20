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

/** A business someone pasted: a place, a brand or an artist (grows in S02). */
export const businesses = pgTable(
  "businesses",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    url: text().notNull(),
    name: text(),
    ...timestamps,
  },
  (t) => [index("businesses_owner_idx").on(t.ownerId)],
)

export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "waiting",
  "done",
  "failed",
  "cancelled",
])

/** One piece of slow work (reading a site, asking Qloo, an agent's turn), watched live. */
export const runs = pgTable(
  "runs",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    businessId: uuid().references(() => businesses.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    status: runStatus().default("queued").notNull(),
    error: text(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("runs_owner_idx").on(t.ownerId), index("runs_business_idx").on(t.businessId)],
)

/**
 * What a run did, step by step: append-only, so a reconnecting page replays exactly what it missed
 * (ids are ordered). Each row is announced on the live channel in the same transaction.
 */
export const runEvents = pgTable(
  "run_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    runId: uuid()
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    type: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("run_events_run_idx").on(t.runId, t.id)],
)
