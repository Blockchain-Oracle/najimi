import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { runs } from "./core"

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
 * Every Qloo call made for someone, cached or not. Because chips point here: which endpoint,
 * which signal, what came back. The Built-on-Qloo panel lists a chat's calls. Rows without a user
 * are shared lookups (the loves typeahead) and are never shown as anyone's evidence.
 */
export const qlooCalls = pgTable(
  "qloo_calls",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid(),
    /** The AI SDK message whose tool made the call. */
    messageId: text(),
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
  (t) => [
    index("qloo_calls_created_idx").on(t.createdAt),
    index("qloo_calls_user_idx").on(t.userId, t.createdAt),
    index("qloo_calls_chat_idx").on(t.chatId, t.createdAt),
  ],
)
