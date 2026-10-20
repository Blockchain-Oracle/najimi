import {
  bigserial,
  doublePrecision,
  index,
  integer,
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

export const businessStatus = pgEnum("business_status", [
  "reading",
  "matching",
  "confirm",
  "ready",
  "failed",
])

export const businessKind = pgEnum("business_kind", ["place", "brand", "artist", "other"])

/** A business someone pasted: a place, a brand or an artist, with what its site says (F1). */
export const businesses = pgTable(
  "businesses",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: owner(),
    url: text().notNull(),
    host: text(),
    status: businessStatus().default("reading").notNull(),
    name: text(),
    kind: businessKind(),
    category: text(),
    summary: text(),
    /** BCP-47: generated content is written in this language (F28, R11). */
    language: text(),
    address: text(),
    city: text(),
    country: text(),
    lat: doublePrecision(),
    lon: doublePrecision(),
    phone: text(),
    faviconUrl: text(),
    imageUrl: text(),
    socials: jsonb().$type<Record<string, string>>().default({}).notNull(),
    offerings: jsonb().$type<{ name: string; detail: string | null }[]>().default([]).notNull(),
    comparableNames: jsonb().$type<string[]>().default([]).notNull(),
    /** The run that read it (its live steps). */
    setupRunId: uuid(),
    error: text(),
    ...timestamps,
  },
  (t) => [index("businesses_owner_idx").on(t.ownerId)],
)

/**
 * The fact sheet (F10): the only source of product facts agents may use. Read from the site with
 * the page each came from; the owner edits, adds and removes rows.
 */
export const businessFacts = pgTable(
  "business_facts",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    label: text().notNull(),
    value: text().notNull(),
    sourceUrl: text(),
    origin: text().$type<"site" | "owner">().default("site").notNull(),
    position: integer().default(0).notNull(),
    ...timestamps,
  },
  (t) => [index("business_facts_business_idx").on(t.businessId, t.position)],
)

/**
 * The business in Qloo (F2): its own entity (confirmed), the candidates it was chosen from, and
 * the comparables its audience is found through. `data` is the entity as the product shows it.
 */
export const qlooMatches = pgTable(
  "qloo_matches",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    role: text().$type<"own" | "candidate" | "comparable" | "competitor">().notNull(),
    entityId: text().notNull(),
    name: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    evidence: jsonb().$type<string[]>().default([]).notNull(),
    /** How the comparables were found ("competitive-set", "neighbours", "site-suggestions"). */
    route: text(),
    callId: uuid(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("qloo_matches_business_idx").on(t.businessId, t.role)],
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
