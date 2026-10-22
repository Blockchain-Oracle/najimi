import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export type SocialPlatform = "x" | "instagram" | "tiktok" | "youtube"

/** One thing to do in a feed today: follow someone, add a topic, mute something. */
export type TuneUpItem = {
  id: string
  platform: SocialPlatform
  kind: "follow" | "topics" | "search" | "reset" | "mute"
  label: string
  /** Why it's there, in a few words ("Because you love Burna Boy"). */
  why: string | null
  handle?: string | null
  image?: string | null
  /** Where tapping it goes: the exact profile, intent or settings page. */
  url: string | null
  /** Words to copy into the platform (Instagram's Your Algorithm, TikTok's topics). */
  words?: string[]
  done: boolean
}

/**
 * The daily tune-up (W15): a five-minute list per day that turns someone's feeds toward their
 * taste — real accounts Qloo matched, topics for each platform's own feed controls — ticked off
 * as they go.
 */
export const tuneUps = pgTable(
  "tune_ups",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    day: date().notNull(),
    items: jsonb().$type<TuneUpItem[]>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("tune_ups_user_day_idx").on(t.userId, t.day)],
)

/**
 * How much of a feed is "you" (W15): a screenshot of For You / Explore read by a vision model,
 * every name matched to Qloo and scored against the person's taste. Kept, so the change shows.
 */
export const feedScores = pgTable(
  "feed_scores",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    platform: text().$type<SocialPlatform>().notNull(),
    /** 0–100: the share of what's on screen that fits their taste. */
    score: integer().notNull(),
    matched: jsonb()
      .$type<{ qlooId: string; name: string; image: string | null; fit: number }[]>()
      .notNull(),
    /** What doesn't fit (names as seen). */
    off: jsonb().$type<string[]>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("feed_scores_user_idx").on(t.userId, t.createdAt)],
)
