import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { businesses, runs } from "./core"

/**
 * Qloo responses, cached privately (the hackathon guide allows server-side caching with no time
 * limit, and forbids publishing responses: they live here, never in the repository).
 * The key is a hash of the path and its sorted parameters.
 */
export const qlooCache = pgTable("qloo_cache", {
  key: text().primaryKey(),
  path: text().notNull(),
  params: jsonb().$type<Record<string, string>>().notNull(),
  status: integer().notNull(),
  body: jsonb().$type<unknown>().notNull(),
  fetchedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
})

/**
 * Every Qloo call a business's work made, cached or not. Evidence chips point here (plan R1):
 * which endpoint, which signal, what came back. The Built-on-Qloo panel lists them.
 */
export const qlooCalls = pgTable(
  "qloo_calls",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: uuid().references(() => businesses.id, { onDelete: "cascade" }),
    runId: uuid().references(() => runs.id, { onDelete: "set null" }),
    /** Why the call was made, in plain words ("Music your people love"). */
    purpose: text(),
    path: text().notNull(),
    params: jsonb().$type<Record<string, string>>().notNull(),
    cacheKey: text().notNull(),
    status: integer(),
    ms: integer(),
    cacheHit: boolean().default(false).notNull(),
    resultCount: integer(),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("qloo_calls_business_idx").on(t.businessId, t.createdAt)],
)
