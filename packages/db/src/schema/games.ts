import {
  boolean,
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
import { chats } from "./chat"

export type GameKind = "wavelength" | "knowme" | "twins" | "blind"

/** One item of a round, with its truth (never sent to a player before they answer). */
export type GameItem = {
  qlooId: string
  type: string
  name: string
  image: string | null
  caption: string | null
  /** wavelength/blind: Qloo's 0–100 for the subject's taste; knowme/twins: the right option's index. */
  truth: number
  /** knowme/twins: the choices. */
  options?: { id: string; label: string; image?: string | null; look?: string | null }[]
}

/**
 * A game (W9): a few items about one person's taste (or the player's own, for Blind Taste), built
 * from Qloo at creation and kept with their truths. In a circle, or open to anyone with its link.
 */
export const gameRounds = pgTable(
  "game_rounds",
  {
    id: uuid().defaultRandom().primaryKey(),
    kind: text().$type<GameKind>().notNull(),
    chatId: uuid().references(() => chats.id, { onDelete: "cascade" }),
    /** Whose taste it's about (Blind Taste: null, it's each player's own). */
    subjectId: text().references(() => user.id, { onDelete: "cascade" }),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    items: jsonb().$type<GameItem[]>().notNull(),
    /** The challenge link (`/play/<token>`): anyone can play, no account needed. */
    token: text().notNull(),
    /** The circle's daily drop. */
    daily: boolean().default(false).notNull(),
    /** Najimi's own answers, for playing against it. */
    najimi: jsonb().$type<{ answers: number[]; score: number }>(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("game_rounds_token_idx").on(t.token),
    index("game_rounds_chat_idx").on(t.chatId, t.createdAt),
  ],
)

/** One player's go at a round: a person, or a guest by name (a challenge link). */
export const gameAnswers = pgTable(
  "game_answers",
  {
    id: uuid().defaultRandom().primaryKey(),
    roundId: uuid()
      .notNull()
      .references(() => gameRounds.id, { onDelete: "cascade" }),
    playerId: text().references(() => user.id, { onDelete: "cascade" }),
    /** A guest (no account) playing from a challenge link: a key kept in their browser. */
    guestKey: text(),
    guestName: text(),
    answers: jsonb().$type<number[]>().notNull(),
    score: integer().notNull(),
    /** Blind Taste: how many of Qloo's predictions matched. */
    right: integer(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("game_answers_player_idx").on(t.roundId, t.playerId),
    uniqueIndex("game_answers_guest_idx").on(t.roundId, t.guestKey),
    index("game_answers_time_idx").on(t.createdAt),
  ],
)
