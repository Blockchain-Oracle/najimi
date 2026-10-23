import {
  boolean,
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
  /** The account to act on there (X/Instagram/TikTok username, YouTube channel id). */
  target?: string | null
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

/**
 * A social account someone connected so Najimi can read what they follow and act for them ("Do it
 * for me"). The session (cookies or the platform's own settings) is sealed with CONNECTOR_SECRET,
 * opened only in the worker, never sent to a browser, and wiped on disconnect. `pool` rows are
 * spare accounts Najimi reads public handles with; their owner is the Najimi system user.
 */
export const connectorSessions = pgTable(
  "connector_sessions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    platform: text().$type<SocialPlatform>().notNull(),
    mode: text().$type<"own" | "pool">().notNull().default("own"),
    /** The account's id and handle on the platform. */
    accountId: text().notNull(),
    handle: text(),
    name: text(),
    image: text(),
    secretEnc: text().notNull(),
    status: text().$type<"active" | "expired" | "locked">().notNull().default("active"),
    /** "Do it for me": the agent runs this platform's tune-up itself. */
    autopilot: boolean().notNull().default(false),
    /** The Like agent: each morning, likes the newest post of accounts in the person's taste. */
    likes: boolean().notNull().default(false),
    /** The Post agent: off, drafts a weekly post and asks first, or posts it itself. */
    posts: text().$type<"off" | "ask" | "auto">().notNull().default("off"),
    /** Where the person is, so their tune-up runs on their day. */
    tz: text(),
    /** The platform pushed back: nothing is done for them until then. */
    pausedUntil: timestamp({ withTimezone: true }),
    lastError: text(),
    lastUsedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("connector_sessions_owner_idx").on(t.userId, t.platform, t.accountId)],
)

export type SocialActionKind = "follow" | "like" | "save" | "post" | "subscribe" | "read"

/**
 * Everything Najimi did on a platform for someone, or tried to: the record the pacing caps count,
 * the screen reports, and the agent reads back.
 */
export const socialActions = pgTable(
  "social_actions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    platform: text().$type<SocialPlatform>().notNull(),
    kind: text().$type<SocialActionKind>().notNull(),
    /** Who or what it was done to (handle, post id), and how it reads. */
    target: text().notNull(),
    label: text(),
    /** The tune-up item it came from, when it did. */
    itemId: text(),
    status: text().$type<"done" | "failed" | "skipped">().notNull(),
    detail: text(),
    /** Where the result lives (the post, the profile). */
    url: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("social_actions_user_idx").on(t.userId, t.platform, t.createdAt)],
)

/** A platform whose data a person can download and bring in (W14). */
export type ExportSource = "x" | "instagram" | "tiktok" | "youtube" | "spotify"

/**
 * A data download someone asked a platform for, from Najimi: when, when it's usually ready, and
 * when Najimi reminded them. Bringing the file in clears it.
 */
export const exportRequests = pgTable(
  "export_requests",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    platform: text().$type<ExportSource>().notNull(),
    requestedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    readyAt: timestamp({ withTimezone: true }).notNull(),
    nudgedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("export_requests_user_platform").on(t.userId, t.platform),
    index("export_requests_ready_idx").on(t.readyAt),
  ],
)

/**
 * A post the Post agent wrote from someone's week in taste: waiting for their yes (or posted by
 * itself when they said "just do it"), then what happened to it.
 */
export const postDrafts = pgTable(
  "post_drafts",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    platform: text().$type<SocialPlatform>().notNull(),
    text: text().notNull(),
    status: text().$type<"ready" | "posted" | "skipped" | "failed">().notNull().default("ready"),
    url: text(),
    detail: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    postedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("post_drafts_user_idx").on(t.userId, t.createdAt)],
)
