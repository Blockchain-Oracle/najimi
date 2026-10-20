import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { businesses, runs } from "./core"

/** Every Claude call: model, effort, tokens (cache reads included), time, refusals (plan §4.5). */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: uuid().references(() => businesses.id, { onDelete: "cascade" }),
    runId: uuid().references(() => runs.id, { onDelete: "set null" }),
    purpose: text().notNull(),
    model: text().notNull(),
    effort: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    cacheReadTokens: integer(),
    cacheWriteTokens: integer(),
    ms: integer(),
    stopReason: text(),
    refusalCategory: text(),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("llm_calls_business_idx").on(t.businessId, t.createdAt)],
)
