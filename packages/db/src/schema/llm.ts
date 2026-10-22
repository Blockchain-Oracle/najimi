import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { runs } from "./core"

/**
 * Every model call (chat turns, titles, comparisons): the provider and model that actually answered,
 * tokens (cache reads included), tool calls, time, refusals.
 */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid(),
    messageId: text(),
    runId: uuid().references(() => runs.id, { onDelete: "set null" }),
    purpose: text().notNull(),
    provider: text(),
    model: text().notNull(),
    toolCalls: integer(),
    effort: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    cacheReadTokens: integer(),
    cacheWriteTokens: integer(),
    ms: integer(),
    /** What the call cost in US dollars (tokens × the model's price), for the spend in Settings. */
    costUsd: doublePrecision(),
    stopReason: text(),
    refusalCategory: text(),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("llm_calls_created_idx").on(t.createdAt),
    index("llm_calls_user_idx").on(t.userId, t.createdAt),
  ],
)
